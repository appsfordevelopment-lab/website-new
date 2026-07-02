(function () {
  const SHOPIFY_DOMAIN = 'hi2ieu-nj.myshopify.com';
  const STOREFRONT_TOKEN = '86cad910717ebd41d100eb08dc7c66e0';
  const CART_QTY_KEY = 'tymeboxed_cart_qty';
  const CART_ID_KEY = 'tymeboxed_cart_id';
  const OPEN_CART_KEY = 'tymeboxed_open_cart';

  const fab = document.getElementById('cart-fab');
  const fabCount = document.getElementById('cart-fab-count');
  if (!fab || !fabCount) return;

  function isCheckoutPage() {
    const path = window.location.pathname;
    return path.endsWith('preorder.html') || path.endsWith('/preorder');
  }

  function getQty() {
    return Math.max(0, parseInt(localStorage.getItem(CART_QTY_KEY) || '0', 10) || 0);
  }

  function getCartQtyFromModel(cart) {
    if (!cart) return 0;
    var m = cart.model || cart;
    if (typeof m.totalQuantity === 'number' && m.totalQuantity > 0) return m.totalQuantity;
    if (m.lineItems && m.lineItems.length) {
      return m.lineItems.reduce(function (sum, item) {
        return sum + (item.quantity || 0);
      }, 0);
    }
    if (typeof m.lineItemCount === 'number' && m.lineItemCount > 0) return m.lineItemCount;
    return 0;
  }

  function updateFab(qty) {
    var count = Math.max(0, parseInt(qty, 10) || 0);
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
    var qty = getQty();
    if (qty > 0) {
      fabCount.textContent = String(qty);
      fab.classList.add('visible');
    } else {
      fab.classList.remove('visible');
    }
  }

  async function shopifyGql(query, variables) {
    var res = await fetch('https://' + SHOPIFY_DOMAIN + '/api/2024-10/graphql.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query: query, variables: variables || {} }),
    });
    return res.json();
  }

  async function refreshCartFromShopify() {
    var cartId = localStorage.getItem(CART_ID_KEY);
    if (!cartId) return;
    try {
      var result = await shopifyGql(
        'query($id: ID!) { cart(id: $id) { id checkoutUrl totalQuantity } }',
        { id: cartId }
      );
      var cart = result.data && result.data.cart;
      if (cart && cart.totalQuantity > 0) {
        localStorage.setItem(CART_ID_KEY, cart.id);
        updateFab(cart.totalQuantity);
      } else if (result.data) {
        updateFab(0);
      }
    } catch (e) {}
  }

  function openShopifyCartDrawer() {
    if (window.tymeBoxedOpenCart && window.tymeBoxedOpenCart()) return true;
    var toggle = document.querySelector('.shopify-buy__cart-toggle, .shopify-buy-frame--toggle');
    if (toggle) {
      toggle.click();
      return true;
    }
    return false;
  }

  function openShopifyCartDrawerWithRetry(done) {
    var tries = 25;
    var timer = setInterval(function () {
      if (openShopifyCartDrawer()) {
        clearInterval(timer);
        if (done) done(true);
      } else if (tries-- <= 0) {
        clearInterval(timer);
        if (done) done(false);
      }
    }, 200);
  }

  function openCartDrawer() {
    if (getQty() < 1) return;

    if (window.tymeBoxedTrackInitiateCheckout) window.tymeBoxedTrackInitiateCheckout();

    if (isCheckoutPage()) {
      openShopifyCartDrawerWithRetry(function (opened) {
        if (!opened) {
          var buy = document.getElementById('buy');
          if (buy) buy.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      return;
    }

    sessionStorage.setItem(OPEN_CART_KEY, '1');
    window.location.assign('preorder.html');
  }

  window.tymeBoxedCartSync = function (qty, cartId) {
    var count = Math.max(0, parseInt(qty, 10) || 0);
    if (cartId) localStorage.setItem(CART_ID_KEY, cartId);
    updateFab(count);
  };

  window.tymeBoxedGetCartQty = getCartQtyFromModel;

  window.tymeBoxedSyncFromCart = function (cart) {
    var qty = getCartQtyFromModel(cart);
    var cartId = (cart && cart.model && cart.model.id) || (cart && cart.id);
    if (qty > 0) {
      window.tymeBoxedCartSync(qty, cartId);
    } else if (cart) {
      window.tymeBoxedCartSync(0);
    }
  };

  // Buy-button fires updateItemQuantity before cart.model is updated,
  // so re-read the model after the network update settles.
  window.tymeBoxedSyncFromCartLater = function (cart) {
    window.tymeBoxedSyncFromCart(cart);
    [400, 1200, 2500].forEach(function (delay) {
      setTimeout(function () {
        window.tymeBoxedSyncFromCart(cart);
      }, delay);
    });
  };

  window.tymeBoxedSyncFromProduct = function (product) {
    if (product && product.cart) window.tymeBoxedSyncFromCart(product.cart);
  };

  window.tymeBoxedOpenCartRetry = openShopifyCartDrawerWithRetry;

  fab.addEventListener('click', openCartDrawer);

  window.addEventListener('storage', function (e) {
    if (e.key === CART_QTY_KEY || e.key === CART_ID_KEY) syncFabFromStorage();
  });
  window.addEventListener('pageshow', function () {
    syncFabFromStorage();
    refreshCartFromShopify();
  });

  syncFabFromStorage();
  refreshCartFromShopify();
})();
