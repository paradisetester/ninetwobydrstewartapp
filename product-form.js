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

        // ================ Custom Code For Testiee Form Submission
const testeeBlocks = document.querySelectorAll(
  '#additional-info-wrapper .additional-infomation-block:not(.template-block)'
);

for (const block of testeeBlocks) {
  try {
    const blockNumberElement = block.querySelector('.block-number');
    if (!blockNumberElement) throw new Error('Unable to determine testee number');

    const blockNumber = blockNumberElement.textContent.trim();

    const name  = block.querySelector('[data-attr="Name"]')?.value?.trim();
    const email = block.querySelector('[data-attr="Email"]')?.value?.trim();
    const dob   = block.querySelector('[data-attr="Date of Birth"]')?.value;
    const gender = block.querySelector('[data-attr="Sex at Birth"]')?.value;

    if (!name || !email || !dob || !gender) {
      throw new Error(`Please complete all fields for Testee ${blockNumber}`);
    }

    const response = await fetch(
      window.patientApiUrl || 'https://classics-task-railway-xml.trycloudflare.com/api/patient',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop: Shopify.shop,
          customerId: window.customerId || '',
          name,
          email,
          dob,
          gender
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

    // Append testee info + patient ID into formData so they go to cart properties
    formData.append(`properties[Testee ${blockNumber} Name]`, name);
    formData.append(`properties[Testee ${blockNumber} Email]`, email);
    formData.append(`properties[Testee ${blockNumber} Date of Birth]`, dob);
    formData.append(`properties[Testee ${blockNumber} Sex at Birth]`, gender);
    formData.append(`properties[Testee ${blockNumber} Patient ID]`, patient.patientId);

  } catch (error) {
    console.error('Patient ID Generation Error:', error);
    alert(error.message);

    this.submitButton.classList.remove('loading');
    this.submitButton.removeAttribute('aria-disabled');
    const spinner = this.querySelector('.loading__spinner');
    if (spinner) spinner.classList.add('hidden');
    return;
  }
}
        // ================ Custom Code For Testiee Form Submission Ends

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
          .then((response) => {
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
