import type { CommerceCart, CommerceCartLine } from './types';

function assertQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('invalid_quantity');
  }
}

export function addCartLine(
  cart: CommerceCart,
  line: CommerceCartLine
): CommerceCart {
  assertQuantity(line.quantity);
  const existing = cart.lines.find((item) => item.variantId === line.variantId);

  const lines = existing
    ? cart.lines.map((item) =>
        item.variantId === line.variantId
          ? { ...item, quantity: item.quantity + line.quantity }
          : { ...item }
      )
    : [...cart.lines.map((item) => ({ ...item })), { ...line }];

  return { ...cart, lines };
}

export function setCartLineQuantity(
  cart: CommerceCart,
  variantId: string,
  quantity: number
): CommerceCart {
  assertQuantity(quantity);
  if (!cart.lines.some((line) => line.variantId === variantId)) {
    throw new Error('cart_line_not_found');
  }

  return {
    ...cart,
    lines: cart.lines.map((line) =>
      line.variantId === variantId ? { ...line, quantity } : { ...line }
    )
  };
}

export function removeCartLine(
  cart: CommerceCart,
  variantId: string
): CommerceCart {
  return {
    ...cart,
    lines: cart.lines
      .filter((line) => line.variantId !== variantId)
      .map((line) => ({ ...line }))
  };
}
