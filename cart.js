(function () {
  const SHOPIFY_DOMAIN = '1q25jg-gp.myshopify.com';
  const STOREFRONT_TOKEN = 'b967500b16539e0ad66d6181ab3d425f';
  const VARIANT_GID = 'gid://shopify/ProductVariant/48125253550250';
  const VARIANT_ID = '48125253550250';
  const CART_QTY_KEY = 'tymeboxed_cart_qty';
  const CART_ID_KEY = 'tymeboxed_cart_id';

  const fab = document.getElementById('cart-fab');
  const fabCount = document.getElementById('cart-fab-count');
  if (!fab || !fabCount) return;

  function getQty() {
    return Math.max(0, parseInt(localStorage.getItem(CART_QTY_KEY) || '0', 10) || 0);
  }

  function updateFab(qty) {
    const count = Math.max(0, parseInt(qty, 10) || 0);
    if (count > 0) {
      localStorage.setItem(CART_QTY_KEY, String(count));
      fabCount.textContent = String(count);
      fab.classList.add('visible');
    } else {
      localStorage.removeItem(CART_QTY_KEY);
      localStorage.removeItem(CART_ID_KEY);
      fab.classList.remove('visible');
    }
  }

  function syncFabFromStorage() {
    const qty = getQty();
    if (qty > 0) {
      fabCount.textContent = String(qty);
      fab.classList.add('visible');
    } else {
      fab.classList.remove('visible');
    }
  }

  async function shopifyGql(query, variables) {
    const res = await fetch('https://' + SHOPIFY_DOMAIN + '/api/2024-10/graphql.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query: query, variables: variables || {} }),
    });
    return res.json();
  }

  async function resolveCheckoutUrl() {
    const cartId = localStorage.getItem(CART_ID_KEY);
    if (cartId) {
      const result = await shopifyGql(
        'query($id: ID!) { cart(id: $id) { id checkoutUrl totalQuantity } }',
        { id: cartId }
      );
      const cart = result.data && result.data.cart;
      if (cart && cart.checkoutUrl && cart.totalQuantity > 0) {
        updateFab(cart.totalQuantity);
        localStorage.setItem(CART_ID_KEY, cart.id);
        return cart.checkoutUrl;
      }
    }

    const qty = Math.max(1, getQty());
    const created = await shopifyGql(
      'mutation($input: CartInput!) { cartCreate(input: $input) { cart { id checkoutUrl totalQuantity } userErrors { message } } }',
      { input: { lines: [{ merchandiseId: VARIANT_GID, quantity: qty }] } }
    );
    const payload = created.data && created.data.cartCreate;
    const cart = payload && payload.cart;
    if (cart && cart.checkoutUrl) {
      localStorage.setItem(CART_ID_KEY, cart.id);
      updateFab(cart.totalQuantity || qty);
      return cart.checkoutUrl;
    }

    return null;
  }

  function permalinkCheckout(qty) {
    return 'https://' + SHOPIFY_DOMAIN + '/cart/add?id=' + VARIANT_ID +
      '&quantity=' + Math.max(1, qty) + '&return_to=/checkout';
  }

  async function goToCheckout() {
    if (getQty() < 1) return;
    fab.disabled = true;
    try {
      const url = await resolveCheckoutUrl();
      window.location.assign(url || permalinkCheckout(getQty()));
    } catch (e) {
      window.location.assign(permalinkCheckout(getQty()));
    } finally {
      fab.disabled = false;
    }
  }

  window.tymeBoxedCartSync = function (qty, cartId) {
    const count = Math.max(0, parseInt(qty, 10) || 0);
    if (cartId) localStorage.setItem(CART_ID_KEY, cartId);
    updateFab(count);
  };

  fab.addEventListener('click', goToCheckout);

  window.addEventListener('storage', function (e) {
    if (e.key === CART_QTY_KEY || e.key === CART_ID_KEY) syncFabFromStorage();
  });
  window.addEventListener('pageshow', syncFabFromStorage);

  syncFabFromStorage();
})();
