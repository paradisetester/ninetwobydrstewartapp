if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.variantIdInput.disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText = this.submitButton.querySelector('span');

        if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      async onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        const spinner = this.querySelector('.loading__spinner');

        if (spinner) {
          spinner.classList.remove('hidden');
        }

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const formData = new FormData(this.form);

        // ================ Custom Code For Testee Form Submission
        const testeeBlocks = document.querySelectorAll(
          '#additional-info-wrapper .additional-infomation-block:not(.template-block)'
        );

        // ── Step 1: Collect & validate all testee fields ──────────────────────
        const testeeData = [];
        for (const block of testeeBlocks) {
          const blockNumberElement = block.querySelector('.block-number');
          if (!blockNumberElement) {
            alert('Unable to determine testee number. Please refresh and try again.');
            this.submitButton.classList.remove('loading');
            this.submitButton.removeAttribute('aria-disabled');
            const spinner = this.querySelector('.loading__spinner');
            if (spinner) spinner.classList.add('hidden');
            return;
          }

          const blockNumber = blockNumberElement.textContent.trim();
          const name    = block.querySelector('[data-attr="Name"]')?.value?.trim();
          const email   = block.querySelector('[data-attr="Email"]')?.value?.trim();
          const dob     = block.querySelector('[data-attr="Date of Birth"]')?.value;
          const gender  = block.querySelector('[data-attr="Sex at Birth"]')?.value;
          const variantId = block.dataset.variantId || block.querySelector('[name="id"]')?.value || null;

          if (!name || !email || !dob || !gender) {
            alert(`Please complete all fields for Testee ${blockNumber}`);
            this.submitButton.classList.remove('loading');
            this.submitButton.removeAttribute('aria-disabled');
            const spinner = this.querySelector('.loading__spinner');
            if (spinner) spinner.classList.add('hidden');
            return;
          }

          testeeData.push({ blockNumber, name, email, dob, gender, variantId });
        }

        // ── Step 2: Create / reuse Patient IDs for each testee ────────────────
        // The API returns an existing patientId if name + dob + gender already exist
        // (i.e. the same person ordering again), so no duplicate records are created.
        for (const { blockNumber, name, email, dob, gender } of testeeData) {
          try {
            const response = await fetch(
              window.patientApiUrl || 'https://ninetwobydrstewartapp.onrender.com/api/patient',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  shop: Shopify.shop,
                  customerId: window.customerId || '',
                  name,
                  email,
                  dob,
                  gender,
                })
              }
            );

            if (!response.ok) {
              let errorMessage = `Failed to generate Patient ID for Testee ${blockNumber}`;
              try {
                const errorData = await response.json();
                if (errorData?.message) errorMessage = errorData.message;
              } catch (e) {}
              throw new Error(errorMessage);
            }

            const patient = await response.json();
            if (!patient.patientId) throw new Error(`No Patient ID returned for Testee ${blockNumber}`);

            const isExisting = patient.isExisting ?? false;
            console.log(
              `[Patient] Testee ${blockNumber} – ${isExisting ? 'existing' : 'new'} Patient ID: ${patient.patientId}`
            );

            // Attach patient ID to cart properties
            formData.append(`properties[Testee ${blockNumber} Patient ID]`, patient.patientId);

          } catch (error) {
            console.error('[Patient] Error:', error);
            alert(error.message);

            this.submitButton.classList.remove('loading');
            this.submitButton.removeAttribute('aria-disabled');
            const spinner = this.querySelector('.loading__spinner');
            if (spinner) spinner.classList.add('hidden');
            return;
          }
        }
        // ================ Custom Code For Testee Form Submission Ends

        if (this.cart) {
          formData.append(
            'sections',
            this.cart.getSectionsToRender().map((section) => section.id)
          );
          formData.append('sections_url', window.location.pathname);
          this.cart.setActiveElement(document.activeElement);
        }
        config.body = formData;

        fetch(`${routes.cart_add_url}`, config)
          .then((response) => response.json())
          .then(async (response) => {
            if (response.status) {
              publish(PUB_SUB_EVENTS.cartError, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                errors: response.errors || response.description,
                message: response.message,
              });
              this.handleErrorMessage(response.description);

              const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
              if (!soldOutMessage) return;
              this.submitButton.setAttribute('aria-disabled', true);
              this.submitButtonText.classList.add('hidden');
              soldOutMessage.classList.remove('hidden');
              this.error = true;
              return;
            } else if (!this.cart) {
              window.location = window.routes.cart_url;
              return;
            }

            // ── Step 3: Post-add discount check ────────────────────────────────
            // We evaluate the FULL cart AFTER the item is added so this works
            // whether the user adds 3 products in one go OR one at a time.
            //
            // Rule: if any single person (matched by name + date-of-birth stored
            // in the line-item properties) has 3 or more line items in the cart,
            // apply "3FOR299".  Otherwise clear any previously applied discount.
            try {
              const cartRes = await fetch('/cart.js', { credentials: 'same-origin' });
              const cart = await cartRes.json();

              // Count DISTINCT line items per unique person (name::dob key).
              // Each line item always counts as 1 regardless of its quantity,
              // because the discount requires 3 *different* tests, not qty=3
              // of the same test.
              const personCount = {};
              for (const item of cart.items) {
                const props = item.properties || {};
                // Properties are stored with keys like "Testee 1 Name", "Testee 1 Date of Birth"
                // Find all testee numbers present in this line item
                const testeeNumbers = new Set();
                for (const key of Object.keys(props)) {
                  const match = key.match(/^Testee\s+(\d+)\s+/i);
                  if (match) testeeNumbers.add(match[1]);
                }

                for (const num of testeeNumbers) {
                  const itemName = (props[`Testee ${num} Name`] || '').trim().toLowerCase();
                  const itemDob  = (props[`Testee ${num} Date of Birth`] || '').trim();
                  if (itemName && itemDob) {
                    const key = `${itemName}::${itemDob}`;
                    // Always +1 per line item, never use item.quantity —
                    // qty=3 of one product is NOT the same as 3 distinct tests.
                    personCount[key] = (personCount[key] || 0) + 1;
                  }
                }
              }

              // Eligible only when a single person has exactly 3 distinct line items.
              // (<3 = not enough tests; different people each with 1 item = not eligible)
              const eligible = Object.values(personCount).some((count) => count >= 3);
              console.log('[Discount] Cart person counts:', personCount, '| Eligible:', eligible);

              if (eligible) {
                console.log('[Discount] Applying 3FOR299...');
                await fetch('/discount/3FOR299', { credentials: 'same-origin' });
                console.log('[Discount] 3FOR299 applied.');
              } else {
                console.log('[Discount] Not eligible – clearing any existing discount...');
                await fetch('/cart/update.js', {
                  method: 'POST',
                  credentials: 'same-origin',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ discount: '' }),
                });
                console.log('[Discount] Discount cleared.');
              }
            } catch (discountErr) {
              console.warn('[Discount] Error during discount check:', discountErr);
            }
            // ── End discount check ──────────────────────────────────────────────

            const startMarker = CartPerformance.createStartingMarker('add:wait-for-subscribers');
            if (!this.error)
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                cartData: response,
              }).then(() => {
                CartPerformance.measureFromMarker('add:wait-for-subscribers', startMarker);
              });
            this.error = false;
            const quickAddModal = this.closest('quick-add-modal');
            if (quickAddModal) {
              document.body.addEventListener(
                'modalClosed',
                () => {
                  setTimeout(() => {
                    CartPerformance.measure("add:paint-updated-sections", () => {
                      this.cart.renderContents(response);
                    });
                  });
                },
                { once: true }
              );
              quickAddModal.hide(true);
            } else {
              CartPerformance.measure("add:paint-updated-sections", () => {
                this.cart.renderContents(response);
              });
            }
          })
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            this.submitButton.classList.remove('loading');
            if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
            if (!this.error) this.submitButton.removeAttribute('aria-disabled');
            if (spinner) {
              spinner.classList.add('hidden');
            }

            CartPerformance.measureFromEvent("add:user-action", evt);
          });
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }
    }
  );
}
