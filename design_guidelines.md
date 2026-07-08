# Bloom Terminal Design Guidelines

## Design Decision Framework Analysis

**Purpose & User Needs**: Utility-Focused - Professional traders need efficiency, data density, and rapid information processing
**Content Characteristics**: Information-Dense - Multiple data streams, charts, and real-time market data
**Market Context**: Function-Differentiated - Performance and data accuracy are paramount
**Component Complexity**: Custom UI Needed - Specialized financial widgets and terminal-style interfaces

**Selected Approach**: Design System Approach with heavy customization for financial terminal authenticity

## Core Design Elements

### A. Color Palette
**Primary Dark Theme** (mimicking authentic financial terminals):
- Background: 0 0% 8% (deep black)
- Primary text: 45 100% 65% (Bloom signature orange/amber)
- Secondary text: 0 0% 75% (light gray)
- Success/Gains: 120 60% 50% (green)
- Danger/Losses: 0 70% 55% (red)
- Warning: 50 100% 60% (yellow for alerts)
- Panel borders: 0 0% 20% (dark gray)
- Input backgrounds: 0 0% 12% (slightly lighter black)

### B. Typography
- **Primary Font**: JetBrains Mono (monospace for terminal authenticity)
- **Secondary Font**: Inter (for UI labels and buttons)
- **Sizes**: Heavy use of small text (12px-14px) for data density
- **Weights**: Regular for data, Medium for headers, Bold for alerts

### C. Layout System
**Tailwind Spacing Strategy**: Use units of 1, 2, 4, 6, 8 for precise terminal-like spacing
- Minimal padding (p-1, p-2) for compact data presentation
- Consistent gaps (gap-4, gap-6) between panels
- Dense grids with tight spacing for maximum information display

### D. Component Library

**Core Terminal Components**:
- **Command Bar**: Top navigation with ticker search and Bloomberg-style shortcuts
- **Multi-Panel Layout**: Resizable grid system with 6-8 simultaneous data windows
- **Real-time Data Tables**: Dense, sortable tables with color-coded price changes
- **Chart Panels**: Dark-themed candlestick charts with orange accent lines
- **News Ticker**: Scrolling headline feed with timestamp formatting
- **Watchlist Sidebar**: Compact symbol list with mini price displays

**Specialized Financial UI**:
- **Terminal-style Buttons**: Rectangular, minimal padding, orange borders on dark backgrounds
- **Data Input Fields**: Black backgrounds with orange borders, monospace text
- **Status Indicators**: Small colored dots for market status (open/closed/pre-market)
- **Price Display Cards**: Large numerical displays with change indicators

### E. Authentic Bloomberg Features

**Visual Authentication**:
- Terminal-style window titles with function codes (like "EQUITY SCREENING <GO>")
- Orange accent borders on active panels
- Minimal use of icons - text-heavy interface
- Dense information hierarchy with consistent spacing
- Real-time updating price colors (green up, red down)

**Navigation Patterns**:
- Keyboard shortcuts displayed prominently
- Command-line style ticker symbol entry
- Tab-based panel switching
- Resizable panel system with snap-to-grid behavior

**Data Presentation**:
- Tabular layouts with alternating row backgrounds
- Precise decimal alignment in price columns
- Compact charts with essential technical indicators only
- News headlines with source attribution and timestamps

## Key Design Principles

1. **Information Density Over Aesthetics**: Pack maximum data into viewable space
2. **Terminal Authenticity**: Maintain the characteristic Bloom orange-on-black aesthetic
3. **Real-time Responsiveness**: Visual indicators for live data updates
4. **Professional Minimalism**: No decorative elements - every pixel serves a function
5. **Rapid Navigation**: Keyboard-first interface with visible shortcuts

This design creates an authentic Bloomberg terminal experience prioritizing data density, professional aesthetics, and rapid information access for serious financial users.