# AUTOMO.ID — SALES CRM DASHBOARD

Build a production-ready **Sales CRM Dashboard** for Automo.id.

The CRM is used by automotive sales representatives to manage unlocked customer leads from first contact until successful transaction.

## PRIMARY OBJECTIVE

Help sales answer three questions immediately:

1. Which leads should I contact now?
2. Which leads are closest to closing?
3. Which follow-ups should I do today?

## APPLICATION LAYOUT

Desktop-first CRM.

Left sidebar navigation.

Header:
- Search
- Notification
- Token Balance
- Premium Badge
- Sales Profile
- WhatsApp Status

Sidebar:

Dashboard
Hot Leads
My Leads
Pipeline
Follow Up
Won
Lost
Top Discount
Token
Referral
Analytics
Profile
Settings

---

# 1. DASHBOARD OVERVIEW

Header:

**Good morning, Budi.**

Subtitle:

**Here is your sales performance today.**

Metric cards:

### Total Leads
128

### Active Leads
32

### Negotiation
14

### Won
8

### Conversion Rate
6.25%

### Token Balance
530

Each metric should be clickable.

---

# 2. PRIORITY LEADS

Create a section:

**Leads yang Perlu Ditindaklanjuti**

Sort based on:
- Lead Score
- Purchase urgency
- Last contact
- Response status
- Estimated closing probability

Lead card:

SUPER HOT

Toyota Fortuner

Purchase:
< 30 days

Target Discount:
Rp35 Juta

Lead Score:
**92/100**

Last Contact:
2 hours ago

Recommended Action:
**Follow Up Today**

CTA:
**Open Lead**

---

# 3. HOT LEADS

Create marketplace-style lead discovery inside CRM.

Filters:

Brand
Model
Price Range
Purchase Timeline
Discount
Lead Score
Location

Each lead card displays:

Vehicle:
Toyota Fortuner

Type:
SUV

Target Discount:
Rp35 Juta

Purchase Timeline:
<30 Days

Lead Score:
92

Unlock Cost:
25 Token

Status:
Available

CTA:
**Unlock Lead — 25 Token**

Before unlocking:
Hide:
- Customer Name
- WhatsApp
- Personal Information

After unlocking:
Display:
- Customer Name
- WhatsApp Number
- Request details
- Contact button

---

# 4. MY LEADS

Create a table view.

Columns:

Customer
Vehicle
Target Discount
Lead Score
Status
Last Contact
Next Follow Up
Actions

Statuses:

Pending
Contacted
Negotiation
Won
Lost

Use clear status badges.

---

# 5. PIPELINE CRM

Create Kanban CRM.

Columns:

### NEW
Newly unlocked leads

### CONTACTED
Customer has been contacted

### NEGOTIATION
Active negotiation

### WON
Successful transaction

### LOST
Lead is no longer active

Each card:

Customer
Vehicle
Lead Score
Discount
Last Activity
Next Follow Up

Allow drag-and-drop between columns.

---

# 6. LEAD DETAIL

When opening a lead, show a detailed CRM panel.

Header:

Customer Name

Vehicle Request

Toyota Fortuner
2.8 GR Sport

Target Discount:
Rp35 Juta

Purchase Timeline:
<30 days

Lead Score:
92/100

---

## CUSTOMER INFORMATION

Name
WhatsApp
Location
Vehicle
Variant
Budget
Target Discount
Purchase Timeline

---

## ACTIVITY TIMELINE

Example:

10:32
Lead unlocked

10:45
WhatsApp contacted

11:20
Customer replied

13:10
Discount discussed

15:30
Follow-up scheduled

---

## INTERNAL NOTES

Allow sales to add private notes.

Example:

"Customer sudah compare dengan Mitsubishi Pajero. Fokus ke harga OTR dan free service."

CTA:

**Add Note**

---

## WHATSAPP ACTION

Large CTA:

**Chat via WhatsApp**

Secondary:

**Schedule Follow Up**

---

# 7. FOLLOW-UP CENTER

Create a dedicated page:

**Follow Up Hari Ini**

Sections:

Overdue
Due Today
Upcoming

Each item:

Customer
Vehicle
Last interaction
Next action
Follow-up time

CTA:

**WhatsApp Customer**

Allow reminders.

---

# 8. WON LEADS

Show successful transactions.

Metrics:

Total Won
Monthly Won
Revenue Potential
Conversion Rate

Table:

Customer
Vehicle
Closing Date
Discount
Status

Create success visual.

---

# 9. LOST LEADS

Show lost opportunities.

Reasons:

Price
Competitor
No Response
Postponed
Wrong Lead
Other

This data should later support analytics and AI lead scoring.

---

# 10. ANALYTICS

Create a sales analytics dashboard.

Metrics:

Total Leads
Unlocked Leads
Contact Rate
Response Rate
Negotiation Rate
Closing Rate
Average Closing Time
Won Deals
Lost Deals

Charts:

Leads per Month
Conversion Funnel
Won vs Lost
Lead Source
Brand Performance
Discount Performance

Add date filters:

7 Days
30 Days
3 Months
12 Months
Custom

---

# 11. TOKEN MANAGEMENT

Header:

**530 Token**

Create:

Current Balance

Token Used This Month

Token Purchased

Token Earned from Referral

CTA:

**Top Up Token**

Transaction history:

Date
Transaction
Token
Balance
Status

Types:
- Lead Unlock
- Top Up
- Referral Bonus
- Promotional Bonus

---

# 12. REFERRAL

Show:

Referral Link

[ COPY LINK ]

Total Referrals

Successful Referrals

Token Earned

Referral history.

Explain:

**Dapatkan +30 Token untuk setiap sales yang berhasil registrasi melalui referral kamu.**

---

# 13. SALES PROFILE

Profile page:

Profile Photo
Sales Name
Brand
Dealer
Location

Verified Badge

Rating:
★★★★★ 4.9

Successful Transactions:
128

Response Rate:
95%

Average Response Time:
<5 minutes

Public profile preview.

Allow sales to edit:
- Bio
- Brand
- Dealer
- Location
- Profile photo
- WhatsApp number

---

# 14. NOTIFICATION SYSTEM

Notifications:

New matching lead
Lead response
Follow-up reminder
Successful transaction
Token purchase
Referral bonus
Premium membership
System notification

---

# 15. PREMIUM EXPERIENCE

Premium sales should see:

Verified Badge
Unlimited lead unlock
Advanced CRM
Analytics
AI insights placeholder
Priority notifications

Add Premium label throughout the dashboard.

---

# 16. FUTURE AI FEATURES

Prepare UI components for future AI features.

### AI Lead Score

Example:

92% likelihood to close within 30 days

### AI Follow-Up Recommendation

Example:

"Customer has not responded for 2 days. Recommended follow-up: send updated discount offer."

### AI Closing Prediction

Example:

Closing probability:
78%

### AI Lead Recommendation

Example:

"3 new leads match your Toyota Fortuner specialization."

These should be designed as future-ready components without requiring actual AI implementation in the MVP.

---

# CRM UX PRINCIPLES

The CRM must prioritize ACTION over information.

The most important CTA should always be obvious:

**Contact Customer**

The dashboard should make it possible to go from:

Lead Discovery
→ Unlock
→ Contact
→ Follow Up
→ Negotiation
→ Won

with minimal clicks.

Use responsive behavior, but prioritize desktop because this is a sales productivity application.

Include:
- Empty states
- Loading states
- Skeletons
- Confirmation modal before Token deduction
- Toast after successful unlock
- Error handling
- Search
- Filters
- Sorting
- Pagination
- Drag & drop pipeline
- Mobile responsive CRM