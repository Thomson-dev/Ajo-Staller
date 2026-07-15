# Ajo

**Trustless rotating savings circles (ROSCA / Esusu) on Stellar.**

Ajo lets a group of people pool money into a shared pot every round, with the full pot going to a different member each round until everyone's had a turn — the traditional West African "Ajo"/"Esusu" savings model, run entirely by a Soroban smart contract instead of a trusted organizer. Members lock a collateral stake when they join; anyone who misses a round's contribution gets slashed to cover the shortfall so the rest of the circle isn't left short, and honest members get their stake back (plus a reputation point) when the circle completes.

- **Live testnet contract**: `CCAWRA5NZZFRM62JAQHK75UQTVLYGSB4GX4HX6AP7WX66FOGHQ66MVJJ` ([view on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CCAWRA5NZZFRM62JAQHK75UQTVLYGSB4GX4HX6AP7WX66FOGHQ66MVJJ))
- **Frontend**: React + Vite dApp, Material Design 3 + glassmorphism, in [`Ajo-frontend/`](Ajo-frontend)
- **Contract**: Rust/Soroban, in [`contracts/Ajo-contract/`](contracts/Ajo-contract) (crate name `hello-world`)

## How it works

1. **Create a circle** — anyone can spin one up, setting the token, the per-round contribution amount, the collateral stake required to join, and how long each round stays open.
2. **Join** — members lock a collateral stake in the contract. Join order = payout order.
3. **Deposit** — every active member contributes the fixed amount each round.
4. **Close the round** — permissionless; anyone can call it once everyone's paid or the round's deadline has passed. Whoever's next in line (and hasn't defaulted) receives the full pot. Anyone who missed the deadline has their collateral slashed to cover their share and is removed from the rotation.
5. **Completion** — once every member has either received a payout or defaulted, the circle closes. Members who never defaulted get their collateral back and a reputation point.

## Contract features

| Layer | What it does |
|---|---|
| **Guards** | No double-joining, no double-depositing, no depositing as a non-member, no depositing after being marked as defaulted, no acting on a completed circle. |
| **Collateral & defaults** | Members lock a stake at `join`. `close_round` is a permissionless trigger (Soroban has no cron) that slashes anyone who missed the deadline, refunds their excess collateral, and keeps the round's payout correct despite the shortfall. |
| **Multi-circle** | Every function is keyed by a `circle_id`, so the contract runs any number of independent circles at once. |
| **Events** | `circle_created`, `member_joined`, `deposit_made`, `member_defaulted`, `round_closed`, `circle_completed` — published via `env.events()` for off-chain indexing/notifications. |
| **Reputation** | Members who complete a circle without ever defaulting earn a global, on-chain reputation score (`get_reputation`). |

### Contract interface

| Function | Description |
|---|---|
| `create_circle(admin, token, amount, collateral, round_duration) -> u64` | Creates a new circle, returns its `circle_id`. `collateral` must be `>= amount`. |
| `join(circle_id, member)` | Locks `collateral` and adds `member` to the circle. |
| `deposit(circle_id, member)` | Pays `amount` into the current round's pot. |
| `close_round(circle_id)` | Permissionless. Closes the round once everyone's paid or the deadline's passed; slashes defaulters, pays the next recipient, advances the round or completes the circle. |
| `get_circle(circle_id) -> Circle` | Full circle state: admin, token, amount, collateral, round, round timing, completed flag. |
| `get_members` / `get_paid` / `get_defaulted` / `get_received` `(circle_id) -> Vec<Address>` | Read-only membership/state lists. |
| `get_reputation(member) -> u32` | Global reputation score, independent of any single circle. |

## Project structure

```
.
├── contracts/
│   └── Ajo-contract/        # Soroban contract (crate: hello-world)
│       ├── src/lib.rs        # Contract logic
│       └── src/test.rs       # Unit tests (10 cases)
├── Ajo-frontend/             # React + Vite dApp
│   ├── src/AjoPanel.tsx       # Main circle dashboard (create/join/deposit/close)
│   ├── src/pages/             # Landing + App routes
│   ├── src/lib/                # Wallet, contract client, motion helpers
│   └── src/contracts/ajo-client/  # Generated TypeScript bindings for the contract
├── Cargo.toml                # Rust workspace
└── README.md
```

## Getting started

### Prerequisites

- [Rust](https://rustup.rs/) with the `wasm32v1-none` target: `rustup target add wasm32v1-none`
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli) (`stellar --version`)
- [Node.js](https://nodejs.org/) 18+ and npm
- A Stellar wallet browser extension, e.g. [Freighter](https://www.freighter.app/), for using the app

### Contract

```bash
# run the test suite
cargo test -p hello-world

# build the deployable wasm
stellar contract build

# deploy to testnet (requires a funded identity — see below)
stellar contract deploy --wasm target/wasm32v1-none/release/hello_world.wasm \
  --source <your-identity> --network testnet --alias ajo

# regenerate the frontend's TypeScript bindings after any contract change
stellar contract bindings typescript --contract-id <new-contract-id> --network testnet \
  --output-dir Ajo-frontend/src/contracts/ajo-client --overwrite
cd Ajo-frontend/src/contracts/ajo-client && npm install && npm run build
```

If you deploy a new contract, also update the `CONTRACT_ID` constant in `Ajo-frontend/src/pages/Landing.tsx`.

### Frontend

```bash
cd Ajo-frontend
npm install
npm run dev       # start the dev server
npm run build     # type-check + production build
npm run lint       # oxlint
```

The app has two routes: `/` (landing page) and `/app` (the circle dashboard). A circle is addressed via `?circle=<id>` in the URL — creating a circle updates the URL so you can share the link with the people joining it.

### Getting testnet tokens

The app's default contribution/collateral token is testnet XLM. To fund a wallet for testing:

- **Freighter**: switch its network to Testnet — if the account balance is 0 it shows a built-in "Fund with Friendbot" button.
- **Friendbot directly**: visit `https://friendbot.stellar.org/?addr=<your public key>` — funds the account with 10,000 test XLM.
- **Stellar CLI**: `stellar keys fund <identity-name> --network testnet`

## Known limitations / follow-ups

- The frontend doesn't yet subscribe to the contract's events — it polls via read calls after each action. Wiring up event subscriptions would remove the need to manually refresh.
- Circle discovery is link-based (`?circle=<id>`) rather than a browsable list of all circles — there's no on-chain "list all circles" call, so a browser UI would need to enumerate `circle_id`s client-side.
- `env.events().publish(...)` is used directly; the SDK's newer `#[contractevent]` macro is the currently-recommended pattern and would clear a deprecation warning at build time.
