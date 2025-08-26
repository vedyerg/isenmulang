# `Isen Mulang`
![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3)

Isen Mulang is a BUIDL project that tackles the critical problem of data fraud and lack of transparency in real-world supply chains. We use an autonomous AI agent to create a verifiable and immutable digital record of a product's journey on a decentralized network.
Our vision is to build complete trust between producers and consumers by ensuring that every product has a transparent and unchangeable digital story.

## How It Works
This project is a perfect example of a multi-agent system powered by NextGen Agent technology.
- The Autonomous Agent (Fetch.ai): An intelligent agent is deployed to act as a "data guardian." It autonomously collects and validates data from physical events in a supply chain, such as a product being harvested or shipped.
- The Immutable Ledger (ICP Canister): The agent records this data onto an ICP blockchain canister. This creates a permanent, tamper-proof audit trail that can be publicly verified by anyone, at any time.

## Key Innovation
Our project demonstrates innovation in several key domains:
- Crypto-AI: It utilizes an autonomous agent to automate a real-world task, moving beyond simple smart contracts to a proactive, intelligent system.
- DePIN: The agent functions as a decentralized node that collects and relays data from the physical world to the blockchain.
- RWA: We link real-world assets (e.g., coffee beans) to a digital record, creating verifiable provenance.

Usage Example: Coffee Bean Provenance An Isen Mulang agent tracks a coffee bean from a farm to a roaster. The agent records the harvest date, processing method, and shipment details onto the blockchain. A consumer can then scan a QR code on the final coffee bag to see the entire verified history, guaranteeing its origin and integrity.

## Fetch.ai Agents
- [Agents](https://agentverse.ai/agents/details/agent1qww045c8sqkxl3chssxcjs0rj4mzssaf0lklge8kq8cyg0epkl7wck2ha50/profile)

## Running the project locally

If you want to test your project locally, you can use the following commands:

```bash
# Starts the replica, running in the background
dfx start --background

# Deploys your canisters to the replica and generates your candid interface
dfx deploy
```