#![no_std]

//! Llavero escrow contract.
//!
//! Holds a fungible token (the "stablecoin" of the demo) from one or many
//! investors until an admin signs `release` — the signal that the Derechos
//! Reales inscription for the property was validated off-chain. On release
//! the full contract balance is transferred to the owner's address.
//!
//! This replaces the "secret-key account" escrow used in the pre-spike MVP:
//! the admin never custody-holds the funds; the contract does, and the admin
//! only holds the authority to release.

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, Symbol,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Owner,
    Token,
    Released,
    TotalDeposited,
    // Per-investor cumulative deposited amount.
    BalanceOf(Address),
}

const DEPOSIT_EVT: Symbol = symbol_short!("deposit");
const RELEASE_EVT: Symbol = symbol_short!("release");
const INIT_EVT: Symbol = symbol_short!("init");

#[contract]
pub struct Escrow;

#[contractimpl]
impl Escrow {
    /// One-shot initialisation. Stores the three addresses that frame the
    /// contract's life: admin (release authority), owner (release destination),
    /// and token (the SAC-backed asset the escrow holds).
    pub fn init(env: Env, admin: Address, owner: Address, token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Released, &false);
        env.storage()
            .instance()
            .set(&DataKey::TotalDeposited, &0_i128);

        env.events().publish((INIT_EVT, admin.clone()), owner);
    }

    /// Investor deposit. Requires the depositor's signature (Freighter) and
    /// pulls `amount` of the pre-configured token into the contract's address.
    pub fn deposit(env: Env, from: Address, amount: i128) {
        if amount <= 0 {
            panic!("amount must be positive");
        }
        if Self::released(env.clone()) {
            panic!("escrow already released");
        }

        from.require_auth();

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialized");

        let client = token::Client::new(&env, &token_addr);
        client.transfer(&from, &env.current_contract_address(), &amount);

        let prev_total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalDeposited)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalDeposited, &(prev_total + amount));

        let prev_investor: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::BalanceOf(from.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::BalanceOf(from.clone()), &(prev_investor + amount));

        env.events().publish((DEPOSIT_EVT, from), amount);
    }

    /// Admin-only release. Sends the full contract balance to the owner
    /// configured at `init`, then latches `released = true` so the contract
    /// can never be reopened.
    pub fn release(env: Env) {
        if Self::released(env.clone()) {
            panic!("already released");
        }

        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialized");
        let owner: Address = env
            .storage()
            .instance()
            .get(&DataKey::Owner)
            .expect("not initialized");

        let client = token::Client::new(&env, &token_addr);
        let balance = client.balance(&env.current_contract_address());
        if balance <= 0 {
            panic!("nothing to release");
        }

        client.transfer(&env.current_contract_address(), &owner, &balance);
        env.storage().instance().set(&DataKey::Released, &true);

        env.events().publish((RELEASE_EVT, admin), balance);
    }

    pub fn released(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Released)
            .unwrap_or(false)
    }

    pub fn total_deposited(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalDeposited)
            .unwrap_or(0)
    }

    pub fn balance_of(env: Env, investor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::BalanceOf(investor))
            .unwrap_or(0)
    }

    pub fn admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized")
    }

    pub fn owner(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Owner)
            .expect("not initialized")
    }

    pub fn token(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialized")
    }
}

#[cfg(test)]
mod test;
