// Coffee Supply Chain Backend Canister in Rust
// This canister replicates the functionality of the Motoko version,
// managing an immutable ledger of coffee lots using stable storage.

// The standard libraries for building on the Internet Computer in Rust.
use ic_cdk::{
    api::{
        msg_caller,
        time as get_time,
    },
    export_candid,
};

// The import path for VirtualMemory has been corrected.
// It is now imported from the memory_manager module.
// The BoundedStorable import is no longer needed.
use ic_stable_structures::{
    StableBTreeMap,
    DefaultMemoryImpl,
    BoundedStorable,
    memory_manager::{
        MemoryManager,
        MemoryId,
        VirtualMemory,
    },
    storable::Storable // Corrected import to only use the Storable trait.
};
use candid::{
    CandidType,
    Deserialize,
    Decode,
    Encode,
    Principal,
};
use std::{
    cell::RefCell,
    borrow::Cow,
};

// Define the Memory type alias using VirtualMemory.
type Memory = VirtualMemory<DefaultMemoryImpl>;
const MAX_VALUE_SIZE: u32 = 1024;

// --- Data Structures ---
// These structs define the data types for our application, mirroring the Motoko types.
#[derive(Clone, CandidType, Deserialize)]
struct Update {
    status: String,
    details: String,
    timestamp: u64,
    updated_by: Principal,
}

#[derive(Clone, CandidType, Deserialize)]
struct CoffeeLot {
    id: u64,
    farmer: String,
    harvest_date: String,
    location: String,
    status: String,
    updates: Vec<Update>,
    timestamp: u64,
}

// Implement the Storable trait for the Update struct.
// We now define MAX_SIZE and IS_FIXED_SIZE directly within this trait impl.
impl Storable for Update {

    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }
}

// Implement the Storable trait for the CoffeeLot struct.
// We now define MAX_SIZE and IS_FIXED_SIZE directly within this trait impl.
impl Storable for CoffeeLot {
    
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }
}

#[derive(Clone, CandidType, Deserialize, Ord, PartialOrd, Eq, PartialEq)]
struct StorablePrincipal(Principal);

#[derive(Clone, CandidType, Deserialize, Ord, PartialOrd, Eq, PartialEq)]
struct StorableBoolean(bool);

// Implement the Storable trait for the CoffeeLot struct.
// We now define MAX_SIZE and IS_FIXED_SIZE directly within this trait impl.
impl Storable for StorablePrincipal {
    
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }
}

// Implement the Storable trait for the CoffeeLot struct.
// We now define MAX_SIZE and IS_FIXED_SIZE directly within this trait impl.
impl Storable for StorableBoolean {
    
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }
}


impl BoundedStorable for Update {
    const MAX_SIZE: u32 = MAX_VALUE_SIZE;
    const IS_FIXED_SIZE: bool = false;
}

impl BoundedStorable for CoffeeLot {
    const MAX_SIZE: u32 = MAX_VALUE_SIZE;
    const IS_FIXED_SIZE: bool = false;
}

impl BoundedStorable for StorablePrincipal {
    const MAX_SIZE: u32 = MAX_VALUE_SIZE;
    const IS_FIXED_SIZE: bool = false;
}

impl BoundedStorable for StorableBoolean {
    const MAX_SIZE: u32 = MAX_VALUE_SIZE;
    const IS_FIXED_SIZE: bool = false;
}



// --- Canister State Management ---
// We use a global StableBTreeMap for lots and another for users.
// NOTE: Using `StableBTreeMap` ensures that this data WILL persist across canister upgrades.
thread_local! {
    // We create a MemoryManager to handle our stable memory allocation.
    // It's crucial for managing multiple stable data structures.
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));
    
    // The StableBTreeMap now takes a memory instance from the MemoryManager.
    // MemoryId(0) and MemoryId(1) are used to create separate memory regions.
    // We explicitly specify the generic types with the turbofish operator.
    static LOTS: RefCell<StableBTreeMap<u64, CoffeeLot, Memory>> = RefCell::new(
        StableBTreeMap::<u64, CoffeeLot, Memory>::new(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))
        )
    );
    
    static NEXT_LOT_ID: RefCell<u64> = RefCell::new(0);
    
    // A stable list of registered user principals.
    // We explicitly specify the generic types with the turbofish operator.
    static REGISTERED_USERS: RefCell<StableBTreeMap<StorablePrincipal, StorableBoolean, Memory>> = RefCell::new(
        StableBTreeMap::<StorablePrincipal, StorableBoolean, Memory>::new(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1)))
        )
    );
}

// --- Public Canister Functions (IC API) ---

// A public update function to register the caller as a valid user.
// The `()` is added to satisfy the macro's argument requirement.
#[ic_cdk_macros::update()]
fn register_user() -> bool {
    // Get the principal of the user calling this function.
    let user_principal = msg_caller();
    
    // Add the user to the list of registered users.
    REGISTERED_USERS.with(|users_ref| {
        let mut users = users_ref.borrow_mut();
        users.insert(StorablePrincipal(user_principal), StorableBoolean(true));
        true
    })
}

// A helper function to check if the caller is a registered user.
fn is_caller_registered() -> bool {
    let user_principal = msg_caller();
    REGISTERED_USERS.with(|users_ref| {
        let users = users_ref.borrow();
        users.contains_key(&StorablePrincipal(user_principal))
    })
}

// A public update function to add a new coffee lot.
// The `()` is added to satisfy the macro's argument requirement.
#[ic_cdk_macros::update()]
fn add_lot(farmer: String, harvest_date: String, location: String) -> Option<u64> {
    
    println!("adding lot for");
    //println!(ic_cdk::api::msg_caller().to_string());
    if !is_caller_registered() {
        println!("caller is not registered");
        return None;
    }

    let lot_id = NEXT_LOT_ID.with(|next_id_ref| {
        let mut next_id = next_id_ref.borrow_mut();
        let id = *next_id;
        *next_id += 1;
        id
    });

    let new_lot = CoffeeLot {
        id: lot_id,
        farmer,
        harvest_date,
        location,
        status: "Harvested".to_string(),
        updates: Vec::new(),
        timestamp: get_time(),
    };

    LOTS.with(|lots_ref| {
        lots_ref.borrow_mut().insert(lot_id, new_lot);
    });

    Some(lot_id)
}

// A public update function to update an existing coffee lot.
// The `()` is added to satisfy the macro's argument requirement.
#[ic_cdk_macros::update()]
fn update_lot(lot_id: u64, status: String, details: String) -> Option<String> {
    if !is_caller_registered() {
        return None;
    }
    
    LOTS.with(|lots_ref| {
        let mut lots = lots_ref.borrow_mut();
        
        // Find the lot by ID.
        if let Some(mut lot) = lots.get(&lot_id) {
            // Create a new update record.
            let new_update = Update {
                status: status.clone(),
                details,
                timestamp: get_time(),
                updated_by: msg_caller(),
            };
            
            // Push the new update to the lot's updates vector.
            lot.updates.push(new_update);
            lot.status = status;
            
            // Insert the updated lot back into the map.
            lots.insert(lot_id, lot);
            
            Some("Update successful".to_string())
        } else {
            None
        }
    })
}

// A public query function to retrieve a specific lot by ID.
// The `()` is added to satisfy the macro's argument requirement.
#[ic_cdk_macros::query()]
fn get_lot(lot_id: u64) -> Option<CoffeeLot> {
    LOTS.with(|lots_ref| {
        lots_ref.borrow().get(&lot_id)
    })
}

// A public query function to retrieve all lots.
// The `()` is added to satisfy the macro's argument requirement.
#[ic_cdk_macros::query()]
fn get_all_lots() -> Vec<CoffeeLot> {
    LOTS.with(|lots_ref| {
        lots_ref.borrow().iter().map(|(_, lot)| lot).collect()
    })
}

// This macro generates the Candid interface for the canister.
export_candid!();

// The following section is the Candid interface definition.
// It is part of the canister's public API and is used by clients to
// interact with the canister.
// You can save this block as `coffee_chain_backend.did`.
/*
type Update = record {
  status : text;
  details : text;
  timestamp : nat64;
  updated_by : principal;
};
type CoffeeLot = record {
  id : nat64;
  farmer : text;
  harvest_date : text;
  location : text;
  status : text;
  updates : vec Update;
  timestamp : nat64;
};
service : {
  add_lot : (text, text, text) -> (opt nat64);
  get_lot : (nat64) -> (opt CoffeeLot) query;
  update_lot : (nat64, text, text) -> (opt text);
  get_all_lots : () -> (vec CoffeeLot) query;
  register_user : () -> (bool);
}
*/
