import { NAVISDKClient } from 'navi-sdk'
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { depositCoin, withdrawCoin, borrowCoin, flashloan, repayFlashLoan, SignAndSubmitTXB, mergeCoins } from 'navi-sdk/dist/libs/PTB'
import { Pool, PoolConfig } from "navi-sdk/dist/types";
import { pool } from 'navi-sdk/dist/address'
import { USDC } from 'navi-sdk/dist/address'

import process from 'process';
import * as dotenv from 'dotenv';
dotenv.config();

const mnemonic = process.env.MNEMONICS as string;
const source_usdc_obj_id = process.env.USDC_OBJ_ID as string;
const client = new NAVISDKClient({ mnemonic: mnemonic, networkType: "mainnet", numberOfAccounts: 1 });

(async () => {

    // Initialize the TransactionBlock
    let txb = new TransactionBlock();
    const account = client.accounts[0];
    let sender = account.address;

    txb.setSender(sender);

    const amount_to_borrow = 1 * 1e6; //Borrow 1 USDC

    // Supported: Sui/NAVX/vSui/USDC/USDT/WETH/CETUS/HAsui, import from address file
    const USDC_Pool: PoolConfig = pool[USDC.symbol as keyof Pool];

    // @ts-ignore
    const [balance, receipt] = flashloan(txb, USDC_Pool, amount_to_borrow); // Flashloan 1 usdc

    // balance = 1

    //Transfer the flashloan money to the account
    const this_coin = txb.moveCall({
        target: '0x2::coin::from_balance',
        arguments: [balance],
        typeArguments: [USDC_Pool.type],
    });

    const source_USDC_obj = txb.object(source_usdc_obj_id);

    //Merge Coin to the wallet balance
    txb.mergeCoins(source_USDC_obj, [this_coin]);

    const amount = 1 * 1e6; //Borrow 1 USDC
    //Deposit 1USDC to NAVI Protocol
    // @ts-ignore
    depositCoin(txb, USDC_Pool, source_USDC_obj, amount);

    //Withdraw 1 USDC from NAVI Protocol
    // @ts-ignore
    withdrawCoin(txb, USDC_Pool, amount);

    //Get the repayment object
    const repayBalance = txb.moveCall({
        target: '0x2::coin::into_balance',
        arguments: [source_USDC_obj],
        typeArguments: [USDC_Pool.type],
    });

    // @ts-ignore
    const [e_balance] = repayFlashLoan(txb, USDC_Pool, receipt, repayBalance); // Repay with USDC
    
    //Extra token after repay
    const e_coin = txb.moveCall({
        target: '0x2::coin::from_balance',
        arguments: [e_balance],
        typeArguments: [USDC_Pool.type],
    });

    //Transfer left_money after repay to teh account
    txb.transferObjects([e_coin], sender);

    // @ts-ignore
    const result = SignAndSubmitTXB(txb, account.client, account.keypair);
    console.log("result: ", result);

})()