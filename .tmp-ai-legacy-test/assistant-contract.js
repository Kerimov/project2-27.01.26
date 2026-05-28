"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toLegacyAssistantResponse = toLegacyAssistantResponse;
function toLegacyAssistantResponse(contract, extra) {
    return {
        response: contract.text,
        cards: contract.cards,
        actions: contract.actions,
        safety: contract.safety,
        requiresConfirmation: contract.requiresConfirmation,
        requestId: contract.requestId,
        provider: contract.provider,
        ...(extra || {}),
    };
}
