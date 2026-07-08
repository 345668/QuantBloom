# Bloom Terminal

## Overview

This project is a comprehensive financial terminal that replicates the professional trading interface used by financial institutions. Built with React, TypeScript, and Express, it provides real-time market data visualization, portfolio tracking, watchlist management, and financial news aggregation in an authentic terminal-style interface.

The application serves as a complete financial data platform featuring multi-panel layouts, advanced charting capabilities, stock screening tools, and real-time market updates through WebSocket connections. The design emphasizes data density and rapid information access, featuring the Bloom Terminal's signature dark theme with orange accent colors.

**🚀 NEW: Historical Data Pipeline** - The terminal now features a fully operational historical data ingestion system that automatically populates comprehensive historical price datasets from Yahoo Finance, enabling advanced analytics, predictions, and backtesting capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client uses a modern React stack with TypeScript, built around a component-based architecture that emphasizes reusability and modularity. The main application structure centers on the `BloomTerminal` component, which orchestrates multiple specialized panels using React Grid Layout for resizable, draggable interfaces.

Key architectural patterns include:
- **Component Library Approach**: Extensive use of shadcn/ui components for consistent styling
- **State Management**: React Query for server state management with real-time data caching
- **Layout System**: React Grid Layout for professional terminal-style multi-panel interfaces
- **Styling**: Tailwind CSS with custom Bloom-inspired dark theme
- **Real-time Updates**: WebSocket integration for live market data

The frontend follows a terminal-inspired design system with monospace fonts, dark backgrounds, and orange accent colors to replicate the authentic financial terminal experience.

### Backend Architecture
The server implements a RESTful API using Express.js with TypeScript, following a layered architecture pattern. The backend handles financial data aggregation, user management, and real-time data distribution.

Core backend components:
- **API Layer**: Express routes for market data, watchlists, portfolio management, and news
- **Data Service Layer**: Yahoo Finance integration for real-time stock quotes and historical data
- **WebSocket Layer**: Real-time market updates using WebSocket connections
- **Storage Layer**: Abstracted storage interface supporting both in-memory and database persistence
- **Caching Layer**: In-memory caching for API rate limiting and performance optimization

The architecture prioritizes data freshness with configurable cache TTL and real-time update mechanisms.

### Data Storage Solutions
The application uses a dual storage approach with Drizzle ORM for database operations and PostgreSQL as the primary database. The storage layer includes:

- **Database Schema**: Users, watchlists, and portfolio positions with proper relationships
- **Abstracted Storage Interface**: IStorage interface allowing multiple storage implementations
- **In-Memory Storage**: MemStorage class for development and testing
- **Database Storage**: PostgreSQL with Drizzle ORM for production data persistence
- **Data Types**: Comprehensive TypeScript types for stock quotes, chart data, and news items
- **Historical Data Pipeline**: Automated ingestion system for historical price data with job management and progress tracking
- **Asset Universe**: Curated collection of 418 financial instruments across stocks, indices, ETFs, commodities, and currencies

The schema supports user authentication, personalized watchlists, portfolio tracking with performance calculations, market data caching, and comprehensive historical data storage for advanced analytics.

### Authentication and Authorization
The application implements session-based authentication with user management capabilities. The auth system includes:

- **User Registration/Login**: Username/password authentication
- **Session Management**: Express session handling
- **Data Isolation**: User-specific watchlists and portfolios
- **Route Protection**: API endpoint protection for authenticated users

## External Dependencies

### Financial Data Services
- **Yahoo Finance API**: Primary data source for real-time stock quotes, historical pricing, and market data through the `yahoo-finance2` npm package
- **Market Data Caching**: Local caching layer to manage API rate limits and improve response times
- **Historical Data Ingestion**: Automated pipeline for comprehensive historical price data collection with Yahoo Finance integration
- **Alpha Vantage API**: Secondary data source for enhanced market analytics and alternative data feeds
- **CoinGecko API**: Cryptocurrency market data and trending information

### UI and Styling Framework
- **shadcn/ui**: Comprehensive component library built on Radix UI primitives
- **Radix UI**: Accessible component primitives for complex UI interactions
- **Tailwind CSS**: Utility-first CSS framework with custom Bloom Terminal theme
- **Lucide React**: Icon library for financial and UI iconography

### Data Visualization
- **Recharts**: Charting library for financial data visualization including candlestick charts and market indicators
- **React Grid Layout**: Resizable, draggable panel system for professional terminal-style multi-window interfaces

### Database and ORM
- **PostgreSQL**: Primary database for persistent data storage
- **Drizzle ORM**: Type-safe database ORM with migration support
- **Neon Database**: Serverless PostgreSQL hosting solution

### Development and Build Tools
- **Vite**: Fast build tool and development server with React support
- **TypeScript**: Type safety across the entire application stack
- **ESBuild**: Fast JavaScript bundler for production builds

### Additional Services
- **WebSocket Server**: Real-time market data distribution using native WebSocket API
- **Axios**: HTTP client for external API integrations
- **Cheerio**: Web scraping capabilities for enhanced news aggregation
- **Node-cron**: Scheduled tasks for periodic data updates and historical data processing
- **Zod**: Runtime type validation for API requests and data schemas

## Recent Major Updates

### Historical Data Ingestion Pipeline (September 2025)
Successfully implemented and deployed a comprehensive historical data ingestion system:

**✅ Core Features:**
- Automated job scheduling and management with UUID-based tracking
- Batch processing system (configurable batch sizes) with rate limiting
- Yahoo Finance API integration with proper retry logic and error handling
- Real-time progress tracking and status monitoring
- Data validation and quality assurance with upsert handling
- Support for multiple timeframes (1d, 1wk, 1mo) and asset types

**✅ Technical Implementation:**
- `HistoricalDataIngestion` manager class with comprehensive job lifecycle management
- Database schema with `data_ingestion_jobs` and `historical_prices` tables
- RESTful API endpoints for job control and monitoring
- Robust error handling with automatic recovery and retry mechanisms
- Rate limiting (1s between API calls, 2s between batches)

**✅ Production Status:**
- Currently processing 158 stock assets with 1-year historical data
- Each asset yields ~251 daily price records (trading days)
- Projected total: ~39,758 historical price records
- Job ID: 2b575b09-861d-48df-a45e-8e7fd498ee05 (active)
- Pipeline operational and validated with real data ingestion

**✅ NEW: Historical Data API Endpoints (September 2025)**
Successfully deployed production-ready historical data access layer:

**Core Endpoints:**
- `/api/historical/prices/:symbol` - Historical OHLCV data with returns calculations
- `/api/historical/analytics/:symbol` - Advanced risk metrics including volatility, Sharpe ratio, VaR, max drawdown

**Technical Features:**
- Full Zod validation with date coercion and parameter bounds
- Efficient database queries with proper ordering and limits
- Comprehensive error handling and graceful fallbacks
- Real-time risk analytics integration with benchmark calculations
- Production-tested with live AAPL data returning accurate metrics

**Risk Analytics Capabilities:**
- Volatility calculations (annualized)
- Sharpe ratio computation
- Value at Risk (VaR) at 95% and 99% confidence levels
- Expected Shortfall (Conditional VaR) calculations  
- Maximum Drawdown analysis
- Daily returns series generation

**🎯 Active Capabilities:**
- ✅ Technical indicators and advanced analytics
- ✅ Real-time risk metric calculations  
- ✅ Historical volatility and performance analysis
- 🔄 Machine learning model training datasets available
- 🔄 Portfolio backtesting infrastructure ready
- 🔄 Predictive modeling and forecasting ready