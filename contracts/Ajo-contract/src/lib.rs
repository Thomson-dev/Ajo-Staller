#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, token, Address, Env, Vec};

#[contracttype]
#[derive(Clone)]
pub struct Circle {
    pub admin: Address,
    pub token: Address,
    pub amount: i128,        // contribution required per round
    pub collateral: i128,    // stake locked at join; must be >= amount
    pub round_duration: u64, // seconds a round stays open before it can be force-closed
    pub round: u32,
    pub round_start: u64, // ledger timestamp the current round opened
    pub completed: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    NextCircleId,
    Circle(u64),
    Members(u64),         // Vec<Address>, join order
    Paid(u64),            // Vec<Address> who deposited this round
    Defaulted(u64),       // Vec<Address> permanently removed from rotation
    Received(u64),        // Vec<Address> who already received a payout
    Reputation(Address),  // u32, global across circles
}

#[contract]
pub struct AjoContract;

fn contains(v: &Vec<Address>, item: &Address) -> bool {
    for a in v.iter() {
        if &a == item {
            return true;
        }
    }
    false
}

#[contractimpl]
impl AjoContract {
    // Create a new circle. Anyone can create one; the creator is recorded as admin
    // but has no special ongoing privileges — every function after this is either
    // member-authenticated or permissionless.
    pub fn create_circle(
        env: Env,
        admin: Address,
        token: Address,
        amount: i128,
        collateral: i128,
        round_duration: u64,
    ) -> u64 {
        admin.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        if collateral < amount {
            panic!("collateral must be at least the contribution amount");
        }
        if round_duration == 0 {
            panic!("round_duration must be positive");
        }

        let storage = env.storage().instance();
        let circle_id: u64 = storage.get(&DataKey::NextCircleId).unwrap_or(0);
        storage.set(&DataKey::NextCircleId, &(circle_id + 1));

        let circle = Circle {
            admin: admin.clone(),
            token,
            amount,
            collateral,
            round_duration,
            round: 0,
            round_start: env.ledger().timestamp(),
            completed: false,
        };
        storage.set(&DataKey::Circle(circle_id), &circle);
        storage.set(&DataKey::Members(circle_id), &Vec::<Address>::new(&env));
        storage.set(&DataKey::Paid(circle_id), &Vec::<Address>::new(&env));
        storage.set(&DataKey::Defaulted(circle_id), &Vec::<Address>::new(&env));
        storage.set(&DataKey::Received(circle_id), &Vec::<Address>::new(&env));

        env.events()
            .publish((symbol_short!("created"), circle_id), admin);

        circle_id
    }

    // A member joins the circle. Join order = payout order. Locks a collateral
    // stake that's slashed if the member later misses a round's deposit.
    pub fn join(env: Env, circle_id: u64, member: Address) {
        member.require_auth();
        let storage = env.storage().instance();
        let circle: Circle = storage
            .get(&DataKey::Circle(circle_id))
            .expect("circle not found");
        if circle.completed {
            panic!("circle already completed");
        }

        let mut members: Vec<Address> = storage.get(&DataKey::Members(circle_id)).unwrap();
        if contains(&members, &member) {
            panic!("already joined");
        }

        let client = token::Client::new(&env, &circle.token);
        client.transfer(&member, &env.current_contract_address(), &circle.collateral);

        members.push_back(member.clone());
        storage.set(&DataKey::Members(circle_id), &members);

        env.events()
            .publish((symbol_short!("joined"), circle_id), member);
    }

    // Deposit this round's contribution into the pot.
    pub fn deposit(env: Env, circle_id: u64, member: Address) {
        member.require_auth();
        let storage = env.storage().instance();
        let circle: Circle = storage
            .get(&DataKey::Circle(circle_id))
            .expect("circle not found");
        if circle.completed {
            panic!("circle already completed");
        }

        let members: Vec<Address> = storage.get(&DataKey::Members(circle_id)).unwrap();
        if !contains(&members, &member) {
            panic!("not a member of this circle");
        }

        let defaulted: Vec<Address> = storage.get(&DataKey::Defaulted(circle_id)).unwrap();
        if contains(&defaulted, &member) {
            panic!("member has defaulted and cannot deposit");
        }

        let mut paid: Vec<Address> = storage.get(&DataKey::Paid(circle_id)).unwrap();
        if contains(&paid, &member) {
            panic!("already deposited this round");
        }

        let client = token::Client::new(&env, &circle.token);
        client.transfer(&member, &env.current_contract_address(), &circle.amount);

        paid.push_back(member.clone());
        storage.set(&DataKey::Paid(circle_id), &paid);

        env.events()
            .publish((symbol_short!("deposit"), circle_id), member);
    }

    // Permissionless: closes the round once every active member has paid, or the
    // round deadline has passed (whichever comes first). Members who haven't paid
    // by the deadline are slashed and removed from the rotation.
    pub fn close_round(env: Env, circle_id: u64) {
        let storage = env.storage().instance();
        let mut circle: Circle = storage
            .get(&DataKey::Circle(circle_id))
            .expect("circle not found");
        if circle.completed {
            panic!("circle already completed");
        }

        let members: Vec<Address> = storage.get(&DataKey::Members(circle_id)).unwrap();
        let paid: Vec<Address> = storage.get(&DataKey::Paid(circle_id)).unwrap();
        let mut defaulted: Vec<Address> = storage.get(&DataKey::Defaulted(circle_id)).unwrap();
        let mut received: Vec<Address> = storage.get(&DataKey::Received(circle_id)).unwrap();

        let mut active: Vec<Address> = Vec::new(&env);
        for m in members.iter() {
            if !contains(&defaulted, &m) {
                active.push_back(m.clone());
            }
        }

        let mut everyone_paid = true;
        for m in active.iter() {
            if !contains(&paid, &m) {
                everyone_paid = false;
                break;
            }
        }

        let deadline_passed = env.ledger().timestamp() >= circle.round_start + circle.round_duration;
        if !deadline_passed && !everyone_paid {
            panic!("round still open");
        }

        let token_client = token::Client::new(&env, &circle.token);

        // Slash anyone still active who hasn't paid: their stake covers their
        // share of the pot, and any excess above the round amount is refunded.
        let mut newly_defaulted: Vec<Address> = Vec::new(&env);
        for m in active.iter() {
            if !contains(&paid, &m) {
                defaulted.push_back(m.clone());
                newly_defaulted.push_back(m.clone());
                let refund = circle.collateral - circle.amount;
                if refund > 0 {
                    token_client.transfer(&env.current_contract_address(), &m, &refund);
                }
                env.events()
                    .publish((symbol_short!("default"), circle_id), m.clone());
            }
        }

        // Recipient = first member in join order who hasn't defaulted and hasn't
        // already received a payout.
        let mut recipient: Option<Address> = None;
        for m in members.iter() {
            if !contains(&defaulted, &m) && !contains(&received, &m) {
                recipient = Some(m.clone());
                break;
            }
        }

        let contributors = (paid.len() + newly_defaulted.len()) as i128;
        let pot = circle.amount * contributors;

        if let Some(r) = recipient.clone() {
            if pot > 0 {
                token_client.transfer(&env.current_contract_address(), &r, &pot);
            }
            received.push_back(r);
        }

        storage.set(&DataKey::Defaulted(circle_id), &defaulted);
        storage.set(&DataKey::Received(circle_id), &received);
        storage.set(&DataKey::Paid(circle_id), &Vec::<Address>::new(&env));

        if received.len() + defaulted.len() >= members.len() {
            circle.completed = true;
            storage.set(&DataKey::Circle(circle_id), &circle);

            // Members who finished without defaulting get their stake back and
            // earn reputation. Defaulters already had their stake settled above.
            for m in members.iter() {
                if !contains(&defaulted, &m) {
                    let rep_key = DataKey::Reputation(m.clone());
                    let rep: u32 = storage.get(&rep_key).unwrap_or(0);
                    storage.set(&rep_key, &(rep + 1));
                    token_client.transfer(&env.current_contract_address(), &m, &circle.collateral);
                }
            }

            env.events()
                .publish((symbol_short!("complete"), circle_id), circle.round);
        } else {
            circle.round += 1;
            circle.round_start = env.ledger().timestamp();
            storage.set(&DataKey::Circle(circle_id), &circle);

            if let Some(r) = recipient {
                env.events()
                    .publish((symbol_short!("closed"), circle_id), r);
            }
        }
    }

    // --- read-only helpers ---
    pub fn get_circle(env: Env, circle_id: u64) -> Circle {
        env.storage()
            .instance()
            .get(&DataKey::Circle(circle_id))
            .expect("circle not found")
    }

    pub fn get_members(env: Env, circle_id: u64) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Members(circle_id))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_paid(env: Env, circle_id: u64) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Paid(circle_id))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_defaulted(env: Env, circle_id: u64) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Defaulted(circle_id))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_received(env: Env, circle_id: u64) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Received(circle_id))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_reputation(env: Env, member: Address) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Reputation(member))
            .unwrap_or(0)
    }
}

mod test;
