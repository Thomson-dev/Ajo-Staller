#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    vec,
};

fn create_token<'a>(env: &Env, admin: &Address) -> (TokenClient<'a>, StellarAssetClient<'a>) {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let address = sac.address();
    (
        TokenClient::new(env, &address),
        StellarAssetClient::new(env, &address),
    )
}

fn setup(env: &Env) -> (AjoContractClient<'_>, TokenClient<'_>, StellarAssetClient<'_>, Address) {
    let admin = Address::generate(env);
    let (token, token_admin) = create_token(env, &admin);
    let contract_id = env.register(AjoContract, ());
    let client = AjoContractClient::new(env, &contract_id);
    (client, token, token_admin, admin)
}

#[test]
fn test_full_circle_two_members() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, token, token_admin, admin) = setup(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    token_admin.mint(&alice, &1000);
    token_admin.mint(&bob, &1000);

    let circle_id = client.create_circle(&admin, &token.address, &100, &100, &1000);

    client.join(&circle_id, &alice);
    client.join(&circle_id, &bob);
    assert_eq!(
        client.get_members(&circle_id),
        vec![&env, alice.clone(), bob.clone()]
    );

    // round 0: both pay, alice (first in line) receives the pot
    client.deposit(&circle_id, &alice);
    client.deposit(&circle_id, &bob);
    client.close_round(&circle_id);
    assert_eq!(client.get_circle(&circle_id).round, 1);
    assert_eq!(client.get_circle(&circle_id).completed, false);

    // round 1: both pay again, bob receives the pot and the circle completes
    client.deposit(&circle_id, &alice);
    client.deposit(&circle_id, &bob);
    client.close_round(&circle_id);

    let circle = client.get_circle(&circle_id);
    assert_eq!(circle.completed, true);

    // symmetric circle: everyone gets their own money back plus their collateral
    assert_eq!(token.balance(&alice), 1000);
    assert_eq!(token.balance(&bob), 1000);

    assert_eq!(client.get_reputation(&alice), 1);
    assert_eq!(client.get_reputation(&bob), 1);
}

#[test]
fn test_full_circle_three_members() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, token, token_admin, admin) = setup(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let carol = Address::generate(&env);
    for m in [&alice, &bob, &carol] {
        token_admin.mint(m, &1000);
    }

    let circle_id = client.create_circle(&admin, &token.address, &100, &100, &1000);
    client.join(&circle_id, &alice);
    client.join(&circle_id, &bob);
    client.join(&circle_id, &carol);
    assert_eq!(
        client.get_members(&circle_id),
        vec![&env, alice.clone(), bob.clone(), carol.clone()]
    );

    // three rounds, everyone pays every time; payout order follows join order.
    // the round counter only advances while the circle stays open — the final
    // close_round marks it completed instead of bumping the round.
    let recipients = [&alice, &bob, &carol];
    for (i, recipient) in recipients.iter().enumerate() {
        client.deposit(&circle_id, &alice);
        client.deposit(&circle_id, &bob);
        client.deposit(&circle_id, &carol);
        client.close_round(&circle_id);
        assert!(client.get_received(&circle_id).contains(*recipient));
        if i < recipients.len() - 1 {
            assert_eq!(client.get_circle(&circle_id).round, (i + 1) as u32);
            assert_eq!(client.get_circle(&circle_id).completed, false);
        }
    }

    let circle = client.get_circle(&circle_id);
    assert_eq!(circle.completed, true);

    // symmetric circle: everyone ends up with their money and collateral back
    assert_eq!(token.balance(&alice), 1000);
    assert_eq!(token.balance(&bob), 1000);
    assert_eq!(token.balance(&carol), 1000);

    assert_eq!(client.get_reputation(&alice), 1);
    assert_eq!(client.get_reputation(&bob), 1);
    assert_eq!(client.get_reputation(&carol), 1);
}

#[test]
fn test_default_slashes_collateral_and_still_pays_out() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, token, token_admin, admin) = setup(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    token_admin.mint(&alice, &1000);
    token_admin.mint(&bob, &1000);

    // collateral (150) > amount (100) so we can also verify the excess refund
    let circle_id = client.create_circle(&admin, &token.address, &100, &150, &1000);
    client.join(&circle_id, &alice);
    client.join(&circle_id, &bob);

    // only alice pays this round; bob misses the deadline
    client.deposit(&circle_id, &alice);
    env.ledger().with_mut(|li| li.timestamp = 1001);
    client.close_round(&circle_id);

    // bob: 1000 - 150 (collateral) + 50 (excess refund) = 900 (lost exactly one round's amount)
    assert_eq!(token.balance(&bob), 900);
    assert!(client.get_defaulted(&circle_id).contains(&bob));

    // alice absorbed bob's slashed contribution and got her collateral back:
    // 1000 - 150 (collateral) - 100 (deposit) + 200 (pot) + 150 (collateral refund) = 1100
    assert_eq!(token.balance(&alice), 1100);
    assert!(client.get_received(&circle_id).contains(&alice));

    let circle = client.get_circle(&circle_id);
    assert_eq!(circle.completed, true);
    assert_eq!(client.get_reputation(&alice), 1);
    assert_eq!(client.get_reputation(&bob), 0);
}

#[test]
fn test_defaulted_member_cannot_deposit_again() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, token, token_admin, admin) = setup(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let carol = Address::generate(&env);
    for m in [&alice, &bob, &carol] {
        token_admin.mint(m, &1000);
    }

    let circle_id = client.create_circle(&admin, &token.address, &100, &100, &1000);
    client.join(&circle_id, &alice);
    client.join(&circle_id, &bob);
    client.join(&circle_id, &carol);

    // bob and carol pay, alice doesn't — round still has 3 members so it stays open
    client.deposit(&circle_id, &bob);
    client.deposit(&circle_id, &carol);
    env.ledger().with_mut(|li| li.timestamp = 1001);
    client.close_round(&circle_id);

    assert!(client.get_defaulted(&circle_id).contains(&alice));
    assert_eq!(client.get_circle(&circle_id).completed, false);

    let result = client.try_deposit(&circle_id, &alice);
    assert!(result.is_err());
}

#[test]
fn test_multi_circle_isolation() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, token, token_admin, admin) = setup(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    token_admin.mint(&alice, &1000);
    token_admin.mint(&bob, &1000);

    let circle_a = client.create_circle(&admin, &token.address, &100, &100, &1000);
    let circle_b = client.create_circle(&admin, &token.address, &50, &50, &500);
    assert_ne!(circle_a, circle_b);

    client.join(&circle_a, &alice);
    client.join(&circle_b, &bob);

    assert_eq!(client.get_members(&circle_a), vec![&env, alice.clone()]);
    assert_eq!(client.get_members(&circle_b), vec![&env, bob.clone()]);
}

#[test]
fn test_create_circle_rejects_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, token, _token_admin, admin) = setup(&env);
    let result = client.try_create_circle(&admin, &token.address, &0, &0, &1000);
    assert!(result.is_err());
}

#[test]
fn test_create_circle_rejects_collateral_below_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, token, _token_admin, admin) = setup(&env);
    let result = client.try_create_circle(&admin, &token.address, &100, &50, &1000);
    assert!(result.is_err());
}

#[test]
fn test_join_rejects_duplicate() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, token, token_admin, admin) = setup(&env);
    let alice = Address::generate(&env);
    token_admin.mint(&alice, &1000);

    let circle_id = client.create_circle(&admin, &token.address, &100, &100, &1000);
    client.join(&circle_id, &alice);
    let result = client.try_join(&circle_id, &alice);
    assert!(result.is_err());
}

#[test]
fn test_deposit_rejects_non_member() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, token, token_admin, admin) = setup(&env);
    let alice = Address::generate(&env);
    token_admin.mint(&alice, &1000);

    let circle_id = client.create_circle(&admin, &token.address, &100, &100, &1000);
    let result = client.try_deposit(&circle_id, &alice);
    assert!(result.is_err());
}

#[test]
fn test_deposit_rejects_duplicate_in_same_round() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, token, token_admin, admin) = setup(&env);
    let alice = Address::generate(&env);
    token_admin.mint(&alice, &1000);

    let circle_id = client.create_circle(&admin, &token.address, &100, &100, &1000);
    client.join(&circle_id, &alice);
    client.deposit(&circle_id, &alice);
    let result = client.try_deposit(&circle_id, &alice);
    assert!(result.is_err());
}

#[test]
fn test_close_round_rejects_when_still_open() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, token, token_admin, admin) = setup(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    token_admin.mint(&alice, &1000);
    token_admin.mint(&bob, &1000);

    let circle_id = client.create_circle(&admin, &token.address, &100, &100, &1000);
    client.join(&circle_id, &alice);
    client.join(&circle_id, &bob);
    client.deposit(&circle_id, &alice);
    // bob hasn't paid yet and the deadline hasn't passed
    let result = client.try_close_round(&circle_id);
    assert!(result.is_err());
}
