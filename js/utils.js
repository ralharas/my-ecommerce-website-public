function calculateTotalAmount(cartItems) {
    return cartItems.reduce((total, item) => total + item.quantity * item.price, 0);
}
export default calculateTotalAmount;