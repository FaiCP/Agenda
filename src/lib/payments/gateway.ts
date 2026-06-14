/**
 * Abstracción de pasarela de pagos.
 *
 * MVP: transferencia bancaria con comprobante y aprobación manual.
 * Futuro: implementar esta interfaz con PayPhone, Kushki o De Una
 * (MercadoPago no opera en Ecuador) sin tocar el resto del código.
 */
export interface PaymentGateway {
  /** Inicia un cobro y devuelve URL de pago o instrucciones. */
  createCharge(input: {
    organizationId: string;
    planCode: string;
    amount: number;
  }): Promise<{ type: "redirect"; url: string } | { type: "manual"; instructions: string }>;
}

export const BANK_TRANSFER_INSTRUCTIONS = {
  bank: "Cooperativa de Ahorro y Crédito de la pequeña empresa de Pastaza",
  accountType: "Cuenta de ahorros",
  accountNumber: "170101020443",
  holder: "AgendaPro S.A.S.",
  holderId: "1790000000001",
  note: "Envía el comprobante desde esta página tras realizar la transferencia.",
};

export class BankTransferGateway implements PaymentGateway {
  async createCharge(): Promise<{ type: "manual"; instructions: string }> {
    return {
      type: "manual",
      instructions: `${BANK_TRANSFER_INSTRUCTIONS.bank} · ${BANK_TRANSFER_INSTRUCTIONS.accountType} ${BANK_TRANSFER_INSTRUCTIONS.accountNumber} a nombre de ${BANK_TRANSFER_INSTRUCTIONS.holder}`,
    };
  }
}
