# AUTOMO.ID — MASTER WEB DEVELOPMENT PROMPT

Build a modern, premium, high-conversion automotive marketplace web platform called **Automo.id**.

## Product Context

Automo.id is an Indonesian automotive marketplace focused on **new car lead generation**.

The platform connects:
1. Customers who want to buy a new car
2. Official automotive sales representatives who want qualified leads
3. Sales users who need a CRM to manage their prospects

The core business mechanism is:

Customer submits a car request → Automo.id distributes the lead → Sales compete through offers/discounts → Sales unlock customer contact information using Token/Credit → Sales manage the lead through CRM → Customer can evaluate sales based on verification, rating, transaction history, and response.

The customer does NOT pay to use the platform. Sales monetize the platform through Token/Credit purchases and Premium Membership.

## Main User Experiences

Create three major web experiences:

### A. CUSTOMER
Purpose:
- Find the best car discount
- Submit a car purchase request
- Compare sales
- Track sales responding to the request
- Contact trusted sales through WhatsApp

### B. SALES
Purpose:
- Discover relevant hot leads
- Unlock customer data using Token
- Submit competitive discounts
- Build reputation
- Purchase additional Token
- Upgrade to Premium

### C. CRM
Purpose:
- Manage unlocked leads
- Track lead status
- Manage follow-ups
- Record internal notes
- Monitor conversion
- View sales performance

## Design Direction

Visual style:
- Premium automotive technology
- Modern Indonesian startup
- Clean and highly trustworthy
- Strong conversion-oriented UI
- Professional enough for automotive dealers
- Modern enough for younger car buyers

Use:
- Large typography
- Generous whitespace
- High-quality automotive imagery
- Premium card layouts
- Subtle shadows
- Rounded corners
- Clear CTA hierarchy
- Responsive design
- Mobile-first customer experience
- Desktop-first sales/CRM dashboard

Avoid:
- Generic marketplace appearance
- Overly colorful UI
- Excessive gradients
- Cluttered dashboards
- Cheap-looking automotive visuals

## Suggested Color System

Primary:
- Deep Navy / Dark Blue

Secondary:
- Electric Blue

Accent:
- Green for successful transactions / positive status
- Orange for hot leads / urgency
- Red only for critical warnings

Neutral:
- White
- Light Gray
- Dark Charcoal

## Typography

Use a modern sans-serif typeface such as:
- Inter
- Plus Jakarta Sans
- Manrope

Use strong typography hierarchy for:
- Hero headlines
- Discount percentages
- Car prices
- Lead scores
- CRM metrics

## Global Navigation

Customer navigation:
- Home
- Cari Mobil
- Promo & Diskon
- Sales Terpercaya
- Request Mobil
- Login

Sales navigation:
- Dashboard
- Hot Leads
- My Leads
- Top Discount
- Token
- Referral
- Profile

CRM navigation:
- Overview
- Hot Leads
- Pipeline
- Follow Up
- Won
- Lost
- Notes
- Analytics
- Profile

## Authentication

Use WhatsApp OTP authentication.

The authentication experience should be extremely simple:
1. Enter WhatsApp number
2. Receive OTP
3. Verify OTP
4. Enter platform

Do not use complicated registration forms.

## Core Business Rules

Customer:
- Free
- Can submit vehicle request
- Can see sales profile
- Can see verified badge
- Can see rating and successful transactions

Sales:
- Receive 100 free Token after registration
- Maximum 3 lead unlocks/day on freemium
- +30 Token for successful referral
- Token can be purchased through payment gateway
- Premium users receive Verified Badge
- Premium users receive full CRM access

Lead unlock pricing:
- Low Tier / City Car: 5–10 Token
- Mid Tier / SUV / MPV: 20–30 Token
- High Tier / Luxury / Premium / Sport: 50–100 Token

Token packages:

Starter:
100 Token — Rp100.000

Basic:
250 Token + 10 Bonus — Rp240.000

Pro:
500 Token + 30 Bonus — Rp450.000

Premium:
1.000 Token + 100 Bonus — Rp850.000

Ultimate:
2.000 Token + 300 Bonus — Rp1.600.000

## Technical Requirements

Build reusable components.

Use:
- Component-based architecture
- Responsive layouts
- Reusable cards
- Reusable buttons
- Reusable modal
- Reusable form components
- Reusable status badges
- Reusable data tables
- Reusable dashboard widgets

The UI must be production-ready, not a simple wireframe.

Include:
- Loading states
- Empty states
- Error states
- Success states
- Confirmation modals
- Toast notifications
- Skeleton loaders
- Responsive mobile navigation

The system must be prepared for:
- Real-time lead updates
- Real-time discount ranking
- Payment gateway integration
- WhatsApp integration
- CRM data
- Analytics
- AI lead scoring in future phases

Create clean frontend architecture so API integration can be added later.