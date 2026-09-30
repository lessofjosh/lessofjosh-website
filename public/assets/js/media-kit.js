( function () {
	'use strict';

	const mediaKit = document.querySelector( '#loj-media-kit' );
	const metricsRoot = mediaKit ? mediaKit.querySelector( '[data-loj-metrics]' ) : null;
	const downloadLinks = mediaKit ? Array.from( mediaKit.querySelectorAll( '[data-loj-pdf-download]' ) ) : [];
	const forms = mediaKit ? Array.from( mediaKit.querySelectorAll( 'form[data-loj-form]' ) ) : [];

	if ( ! mediaKit ) {
		return;
	}

	const compactFormatter = new Intl.NumberFormat( document.documentElement.lang || 'en', {
		compactDisplay: 'short',
		maximumFractionDigits: 1,
		notation: 'compact',
	} );
	const percentFormatter = new Intl.NumberFormat( document.documentElement.lang || 'en', {
		maximumFractionDigits: 2,
		minimumFractionDigits: 2,
	} );
	const reduceMotion = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

	const formatMetric = ( value, format ) => {
		if ( ! Number.isFinite( value ) ) {
			return '—';
		}
		return 'percent' === format ? `${ percentFormatter.format( value ) }%` : compactFormatter.format( Math.round( value ) );
	};

	const animateMetric = ( element, target ) => {
		const format = element.dataset.lojFormat || 'compact';
		if ( reduceMotion ) {
			element.textContent = formatMetric( target, format );
			return;
		}

		const duration = 750;
		const started = performance.now();
		const frame = ( now ) => {
			const progress = Math.min( 1, ( now - started ) / duration );
			const eased = 1 - Math.pow( 1 - progress, 3 );
			element.textContent = formatMetric( target * eased, format );
			if ( progress < 1 ) {
				window.requestAnimationFrame( frame );
			}
		};

		window.requestAnimationFrame( frame );
	};

	const hydrateMetrics = async () => {
		if ( ! metricsRoot ) {
			return;
		}

		if ( 'true' === metricsRoot.dataset.lojMetricsLocked ) {
			metricsRoot.querySelectorAll( '[data-loj-metric]' ).forEach( ( element ) => {
				const target = Number( element.dataset.value );
				if ( '' !== element.dataset.value && Number.isFinite( target ) && target >= 0 ) {
					animateMetric( element, target );
				}
			} );
			return;
		}

		metricsRoot.classList.add( 'is-loading' );
		metricsRoot.setAttribute( 'aria-busy', 'true' );
		const endpoint = window.lojMediaKitConfig && window.lojMediaKitConfig.metricsEndpoint;
		const controller = 'AbortController' in window ? new AbortController() : null;
		const timeout = controller ? window.setTimeout( () => controller.abort(), 7000 ) : null;

		try {
			if ( endpoint ) {
				const response = await fetch( endpoint, {
					cache: 'no-store',
					credentials: 'omit',
					headers: { Accept: 'application/json' },
					signal: controller ? controller.signal : undefined,
				} );

				if ( response.ok ) {
					const payload = await response.json();
					const platforms = payload && 'object' === typeof payload.platforms ? payload.platforms : {};

					[ 'facebook', 'youtube', 'instagram', 'tiktok' ].forEach( ( platformKey ) => {
						const card = metricsRoot.querySelector( `[data-loj-platform="${ platformKey }"]` );
						const item = platforms[ platformKey ];
						if ( ! card || ! item || 'object' !== typeof item ) {
							return;
						}

						[ 'followers', 'views', 'engagement_rate' ].forEach( ( metricKey ) => {
							const element = card.querySelector( `[data-loj-metric="${ metricKey }"]` );
							const value = Number( item[ metricKey ] );
							if ( element && null !== item[ metricKey ] && '' !== item[ metricKey ] && Number.isFinite( value ) && value >= 0 ) {
								element.dataset.value = String( value );
							}
						} );
					} );
				}
			}
		} catch ( error ) {
			// Fail-safe to server rendered fallback
		} finally {
			if ( timeout ) {
				window.clearTimeout( timeout );
			}

			metricsRoot.classList.remove( 'is-loading' );
			metricsRoot.setAttribute( 'aria-busy', 'false' );
			metricsRoot.querySelectorAll( '[data-loj-metric]' ).forEach( ( element ) => {
				const target = Number( element.dataset.value );
				if ( '' !== element.dataset.value && Number.isFinite( target ) && target >= 0 ) {
					animateMetric( element, target );
				}
			} );
		}
	};

	hydrateMetrics();

	const fetchFreshIntakeNonce = async ( endpoint ) => {
		const nonceUrl = new URL( endpoint, window.location.origin );
		nonceUrl.searchParams.set( 'action', 'loj_theme_intake_nonce' );
		nonceUrl.searchParams.set( '_', String( Date.now() ) );

		const response = await fetch( nonceUrl.toString(), {
			method: 'GET',
			cache: 'no-store',
			credentials: 'same-origin',
			headers: {
				Accept: 'application/json',
				'X-Requested-With': 'XMLHttpRequest',
			},
		} );
		const result = await response.json();
		const nonce = result && result.success && result.data ? result.data.nonce : '';

		if ( ! response.ok || ! nonce ) {
			throw new Error( 'Your session expired. Refresh the page and try again.' );
		}

		return nonce;
	};

	/**
	 * Brand partnership + media inquiry forms (progressively enhanced; both
	 * still work as normal POSTs without JavaScript).
	 */
	forms.forEach( ( form ) => {
		form.addEventListener( 'submit', async ( event ) => {
			event.preventDefault();

			const submitBtn = form.querySelector( 'button[type="submit"]' );
			const originalText = submitBtn ? submitBtn.textContent : '';
			let feedback = form.querySelector( '.loj-mk__form-feedback' );
			if ( ! feedback ) {
				feedback = document.createElement( 'div' );
				feedback.className = 'loj-mk__form-feedback';
				feedback.tabIndex = -1;
				form.prepend( feedback );
			}
			feedback.hidden = true;

			if ( submitBtn ) {
				submitBtn.disabled = true;
				submitBtn.textContent = 'Sending…';
			}

			const endpoint = ( window.lojMediaKitConfig && window.lojMediaKitConfig.ajaxUrl ) || '/wp-admin/admin-ajax.php';

			try {
				const formData = new FormData( form );
				formData.set( 'loj_theme_nonce', await fetchFreshIntakeNonce( endpoint ) );

				const response = await fetch( endpoint, {
					method: 'POST',
					body: formData,
					cache: 'no-store',
					credentials: 'same-origin',
					headers: { 'X-Requested-With': 'XMLHttpRequest' },
				} );
				const result = await response.json().catch( () => ( {} ) );

				if ( ! response.ok || ! result.success ) {
					throw new Error( ( result.data && result.data.message ) || 'Sorry, the message did not send. Please try again in a few minutes.' );
				}

				feedback.className = 'loj-mk__form-feedback is-success';
				feedback.setAttribute( 'role', 'status' );
				feedback.textContent = result.data.message || 'Thanks. Your message was sent.';
				form.reset();

				if ( typeof window.gtag === 'function' ) {
					window.gtag( 'event', 'generate_lead', { form_id: form.id } );
				}
			} catch ( error ) {
				feedback.className = 'loj-mk__form-feedback is-error';
				feedback.setAttribute( 'role', 'alert' );
				feedback.textContent = error.message;
			} finally {
				feedback.hidden = false;
				feedback.focus( { preventScroll: false } );
				if ( submitBtn ) {
					submitBtn.disabled = false;
					submitBtn.textContent = originalText;
				}
			}
		} );
	} );

	/**
	 * The PDF link is a normal download (the server builds the file); this
	 * only records the download in analytics.
	 */
	downloadLinks.forEach( ( link ) => {
		link.addEventListener( 'click', () => {
			if ( typeof window.gtag === 'function' ) {
				window.gtag( 'event', 'file_download', {
					file_name: 'Less-of-Josh-Media-Kit.pdf',
					file_extension: 'pdf',
					link_text: link.textContent.trim(),
				} );
			}
		} );
	} );
}() );
