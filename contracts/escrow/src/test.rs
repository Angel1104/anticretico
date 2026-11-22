#![cfg(test)]

use super::{Escrow, EscrowClient};
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

fn create_token<'a>(env: &Env, admin: &Address) -> (Address, TokenClient<'a>, StellarAssetClient<'a>) {
    // Use the Stellar Asset Contract test wrapper so mint() works in tests.
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let addr = sac.address();
    (
        addr.clone(),
        TokenClient::new(env, &addr),
        StellarAssetClient::new(env, &addr),
    )
}

fn setup<'a>() -> (
    Env,
    EscrowClient<'a>,
    Address,
    Address,
    Address,
    TokenClient<'a>,
    StellarAssetClient<'a>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let (token_addr, token_client, token_admin_client) = create_token(&env, &token_admin);

    let contract_id = env.register_contract(None, Escrow);
    let escrow = EscrowClient::new(&env, &contract_id);

    escrow.init(&admin, &owner, &token_addr);

    (env, escrow, admin, owner, token_admin, token_client, token_admin_client)
}

#[test]
fn happy_deposit_updates_balances_and_total() {
    let (env, escrow, _admin, _owner, _tadmin, token, token_admin) = setup();
    let investor = Address::generate(&env);
    token_admin.mint(&investor, &1000);

    escrow.deposit(&investor, &400);
    escrow.deposit(&investor, &100);

    assert_eq!(token.balance(&investor), 500);
    assert_eq!(escrow.total_deposited(), 500);
    assert_eq!(escrow.balance_of(&investor), 500);
    assert_eq!(escrow.released(), false);
}

#[test]
fn happy_release_transfers_full_balance_to_owner() {
    let (env, escrow, _admin, owner, _tadmin, token, token_admin) = setup();
    let inv_a = Address::generate(&env);
    let inv_b = Address::generate(&env);
    token_admin.mint(&inv_a, &700);
    token_admin.mint(&inv_b, &300);

    escrow.deposit(&inv_a, &700);
    escrow.deposit(&inv_b, &300);

    assert_eq!(token.balance(&escrow.address), 1000);

    escrow.release();

    assert_eq!(token.balance(&owner), 1000);
    assert_eq!(token.balance(&escrow.address), 0);
    assert_eq!(escrow.released(), true);
}

#[test]
fn non_admin_release_fails_auth() {
    // Disable mock_all_auths to assert require_auth actually runs.
    let env = Env::default();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let token_admin = Address::generate(&env);

    env.mock_all_auths();
    let (token_addr, _token_client, token_admin_client) = create_token(&env, &token_admin);
    let contract_id = env.register_contract(None, Escrow);
    let escrow = EscrowClient::new(&env, &contract_id);
    escrow.init(&admin, &owner, &token_addr);

    let investor = Address::generate(&env);
    token_admin_client.mint(&investor, &500);
    escrow.deposit(&investor, &500);

    // Now simulate a non-admin attempting release: mock auths ONLY for the
    // wrong address. The contract requires admin.require_auth(), so the
    // invocation must panic because admin did not sign.
    env.set_auths(&[]);
    let attacker = Address::generate(&env);
    let _ = attacker; // just to signal intent

    let res = escrow.try_release();
    assert!(res.is_err(), "non-admin release must fail");
    assert_eq!(escrow.released(), false);
}

#[test]
#[should_panic(expected = "already released")]
fn cannot_release_twice() {
    let (env, escrow, _admin, _owner, _tadmin, _token, token_admin) = setup();
    let investor = Address::generate(&env);
    token_admin.mint(&investor, &100);
    escrow.deposit(&investor, &100);
    escrow.release();
    // Second call must panic.
    escrow.release();
}

#[test]
#[should_panic(expected = "already initialized")]
fn init_twice_fails() {
    let (env, escrow, admin, owner, _tadmin, _token, _token_admin) = setup();
    let other_token = Address::generate(&env);
    escrow.init(&admin, &owner, &other_token);
}
