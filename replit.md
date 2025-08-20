# Oracle Query Management System

## Overview

This is an enterprise-grade Oracle database query management system built with a modern full-stack architecture. The application provides secure, controlled, and auditable Oracle database query execution with a comprehensive two-level approval workflow for Oracle 10g and 19c environments. It features role-based access control, query templates, execution tracking, and enterprise-grade security measures designed for production database environments.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom enterprise theme variables
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation resolvers

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Replit Auth with OpenID Connect integration
- **Session Management**: Express sessions with PostgreSQL storage via connect-pg-simple
- **API Design**: RESTful API with consistent error handling and logging middleware

### Database Design
- **Primary Database**: PostgreSQL (configured for Neon serverless)
- **Schema Management**: Drizzle migrations with shared schema definitions
- **Key Tables**:
  - Users table with role-based permissions (user, team_manager, skip_manager)
  - Database servers registry for Oracle instances (10g/19c support)
  - Database tables catalog for each server
  - Queries table with approval workflow tracking
  - Approvals table for two-tier approval system
  - Query templates for standardized operations
  - Sessions table for authentication state

### Authentication & Authorization
- **Provider**: Replit Auth with OIDC (OpenID Connect) integration
- **Session Storage**: PostgreSQL-backed sessions with configurable TTL
- **Role-Based Access**: Three-tier permission system (user, team_manager, skip_manager)
- **Security Features**: CSRF protection, secure cookies, session management

### Approval Workflow System
- **Two-Level Approval**: Team Manager → Skip Manager approval chain
- **Query Lifecycle**: Draft → Submitted → Team Approved → Final Approved → Executed
- **Audit Trail**: Complete tracking of all approval actions with timestamps and comments
- **Role Permissions**: Granular control over who can approve at each level

### Development & Deployment
- **Development Server**: Vite dev server with HMR and Express backend
- **Build Process**: Vite for frontend bundling, esbuild for backend compilation
- **Environment**: Designed for Replit deployment with runtime error overlays
- **Code Quality**: TypeScript strict mode, path aliases, and modular architecture

## External Dependencies

### Core Framework Dependencies
- **@neondatabase/serverless**: Neon PostgreSQL serverless connection
- **drizzle-orm**: TypeScript-first ORM with PostgreSQL dialect
- **@radix-ui/react-***: Comprehensive accessible UI component primitives
- **@tanstack/react-query**: Powerful data synchronization for React
- **express**: Fast, minimalist web framework for Node.js

### Authentication & Security
- **openid-client**: OpenID Connect client implementation
- **passport**: Authentication middleware with strategy support
- **express-session**: Session middleware for Express
- **connect-pg-simple**: PostgreSQL session store adapter

### Development Tools
- **vite**: Next-generation frontend build tool
- **@vitejs/plugin-react**: Official React plugin for Vite
- **tailwindcss**: Utility-first CSS framework
- **typescript**: Static type checking for JavaScript
- **@replit/vite-plugin-***: Replit-specific development enhancements

### Validation & Forms
- **zod**: TypeScript-first schema declaration and validation library
- **react-hook-form**: Performant forms with easy validation
- **@hookform/resolvers**: Validation library resolvers for React Hook Form

### UI & Styling
- **class-variance-authority**: Creating variant-based component APIs
- **clsx**: Utility for constructing className strings conditionally
- **tailwind-merge**: Merge Tailwind CSS classes without style conflicts
- **date-fns**: Modern JavaScript date utility library
- **lucide-react**: Beautiful and consistent icon library