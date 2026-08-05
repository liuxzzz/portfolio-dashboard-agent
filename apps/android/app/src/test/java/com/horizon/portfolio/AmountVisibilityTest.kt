package com.horizon.portfolio

import com.horizon.portfolio.ui.components.formatCurrency
import org.junit.Assert.assertEquals
import org.junit.Test

class AmountVisibilityTest {
    @Test
    fun hiddenCurrencyDoesNotExposeValueOrSign() {
        assertEquals("••••••", formatCurrency(1_286_430.0, visible = false))
        assertEquals("••••••", formatCurrency(8_420.0, showSign = true, visible = false))
    }

    @Test
    fun visibleCurrencyKeepsExistingFormatting() {
        assertEquals("¥1,286,430", formatCurrency(1_286_430.0))
        assertEquals("+¥8,420", formatCurrency(8_420.0, showSign = true))
    }
}
