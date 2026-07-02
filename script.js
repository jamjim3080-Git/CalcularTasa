document.addEventListener('DOMContentLoaded', () => {
    const calculateBtn = document.getElementById('calculateBtn');
    const inputCop = document.getElementById('inputCop');
    const inputMargin = document.getElementById('inputMargin');
    
    // Elements to display results
    const resultsSection = document.getElementById('resultsSection');
    const finalRate = document.getElementById('finalRate');
    const finalRateText = document.getElementById('finalRateText');
    const buyPriceEl = document.getElementById('buyPrice');
    const buyMerchantEl = document.getElementById('buyMerchant');
    const sellPriceEl = document.getElementById('sellPrice');
    const sellMerchantEl = document.getElementById('sellMerchant');
    
    // Details
    const detailGross = document.getElementById('detailGross');
    const detailMarginPct = document.getElementById('detailMarginPct');
    const detailProfit = document.getElementById('detailProfit');
    const detailCapital = document.getElementById('detailCapital');
    const detailUsdt = document.getElementById('detailUsdt');
    const detailVes = document.getElementById('detailVes');
    
    const errorMsg = document.getElementById('errorMsg');
    
    calculateBtn.addEventListener('click', async () => {
        // Reset UI
        errorMsg.classList.add('hidden');
        resultsSection.classList.add('hidden');
        calculateBtn.querySelector('.btn-text').classList.add('hidden');
        calculateBtn.querySelector('.loader').classList.remove('hidden');
        calculateBtn.disabled = true;

        const amountCop = parseFloat(inputCop.value) || 0;
        const marginPct = parseFloat(inputMargin.value) || 0;

        if (amountCop <= 0) {
            showError('Por favor ingresa un monto válido en COP.');
            resetButton();
            return;
        }

        try {
            // 1. Calcular Ganancia y Capital a invertir
            const marginDecimal = marginPct / 100;
            const profit = amountCop * marginDecimal;
            const capital = amountCop - profit;

            // Obtener precio COP usando el capital como filtro
            const copData = await fetchPrice('COP', 'BUY', ['BancolombiaSA'], capital);
            if (!copData) {
                throw new Error('No se encontraron anuncios de compra en Binance.');
            }
            const buyPrice = parseFloat(copData.price);
            
            // 3. Comprar USDT
            const usdtBought = capital / buyPrice;

            // SOLUCIÓN AL CÁLCULO DE BOLÍVARES:
            // Paso A: Obtener precio general sin monto para estimar
            const vesDataGeneral = await fetchPrice('VES', 'SELL', ['Banesco']);
            if (!vesDataGeneral) {
                throw new Error('No se encontraron anuncios de venta en Binance.');
            }
            const estimatedVesPrice = parseFloat(vesDataGeneral.price);
            const estimatedVesAmount = usdtBought * estimatedVesPrice;

            // Paso B: Hacer la búsqueda real filtrando por el monto exacto estimado
            let vesData = await fetchPrice('VES', 'SELL', ['Banesco'], estimatedVesAmount);
            if (!vesData) {
                // Fallback por si la búsqueda exacta no arroja resultados
                vesData = vesDataGeneral;
            }
            const sellPrice = parseFloat(vesData.price);

            // Update UI with market data
            buyPriceEl.textContent = `${buyPrice.toLocaleString('es-CO')} COP`;
            buyMerchantEl.textContent = copData.merchant;
            sellPriceEl.textContent = `${sellPrice.toLocaleString('es-VE')} VES`;
            sellMerchantEl.textContent = vesData.merchant;
            
            // 4. Vender USDT por VES usando el precio real filtrado
            const vesReceived = usdtBought * sellPrice;
            
            // 5. Tasa final (COP por cada 1 VES)
            const exchangeRate = amountCop / vesReceived;

            // Update Details UI
            detailGross.textContent = amountCop.toLocaleString('es-CO');
            detailMarginPct.textContent = marginPct;
            detailProfit.textContent = profit.toLocaleString('es-CO');
            detailCapital.textContent = capital.toLocaleString('es-CO');
            detailUsdt.textContent = usdtBought.toFixed(4);
            detailVes.textContent = vesReceived.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2});

            // Update Final Rate
            finalRate.textContent = exchangeRate.toFixed(4);
            finalRateText.textContent = exchangeRate.toFixed(4);

            // Show results
            resultsSection.classList.remove('hidden');
            
        } catch (error) {
            showError(error.message);
        } finally {
            resetButton();
        }
    });

    async function fetchPrice(fiat, tradeType, payTypes, transAmount = null) {
        const payload = { fiat, tradeType, payTypes };
        if (transAmount) {
            payload.transAmount = transAmount;
        }
        
        // MODO PRUEBA LOCAL (file://)
        // Como los proxys públicos fallan, simulamos la respuesta con los datos
        // reales que obtuvimos anteriormente, solo para que puedas probar la calculadora.
        if (window.location.protocol === 'file:') {
            await new Promise(resolve => setTimeout(resolve, 800)); // Simular retraso de red
            if (fiat === 'COP') {
                return { price: "3356.00", merchant: "NabiGo (Dato Simulado)" };
            } else {
                return { price: "737.900", merchant: "wilce84 (Dato Simulado)" };
            }
        }

        // Si estamos en Vercel, usamos la API local
        try {
            const res = await fetch('/api/prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) throw new Error('Error en el servidor API');
            
            const data = await res.json();
            if (data.data && data.data.length > 0) {
                return {
                    price: data.data[0].adv.price,
                    merchant: data.data[0].advertiser.nickName
                };
            }
            return null;
        } catch (e) {
            throw new Error("No se pudo conectar. Si estás en local, el servidor de Vercel no está disponible.");
        }
    }

    function showError(msg) {
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
    }

    function resetButton() {
        calculateBtn.querySelector('.btn-text').classList.remove('hidden');
        calculateBtn.querySelector('.loader').classList.add('hidden');
        calculateBtn.disabled = false;
    }
});
