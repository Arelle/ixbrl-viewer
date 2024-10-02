// See COPYRIGHT.md for copyright information

import i18next from 'i18next';
import { NAMESPACE_XBRLI } from "./util.js";

export class Balance {
    constructor(balance) {
        this.balance = balance;
    }

    label() {
        return i18next.t(`balanceTypes:${this.balance}`, {defaultValue: this.balance});
    }
}
