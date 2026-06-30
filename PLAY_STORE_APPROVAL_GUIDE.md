# Lovedogs 360 Google Play Approval Guide

## What Google Rejected

Google rejected the release because the current Play Console account/declarations indicate that Lovedogs 360 provides features that must be published from an Organization developer account.

The relevant Play Console Requirements categories are:

- Financial products/services, such as banking, loans, investments, crypto wallets, crypto exchanges, money transfer, or stored-value wallet services.
- Health apps, including medical apps and health-related human-subjects research apps.
- Apps approved to use Android `VpnService`.
- Government apps or apps developed on behalf of a government agency.

Lovedogs 360 has program scorecards, impact tracking, consent, wellbeing/stress questions, follow-up surveys, evidence, and partner reporting. If those features remain in the app, the right compliance path is an Organization developer account with accurate App content declarations.

## Current App Direction

This release keeps the app functionally complete:

- Participant baseline and follow-up scorecard surveys remain available.
- Program journey, wellbeing/stress check-ins, facilitator workflows, and impact tracking remain available.
- Admins can enable/configure impact tracking per event.
- Admin reporting/export can include impact data.
- Marketplace payment wording should describe Pesapal checkout, seller earnings, and seller payouts rather than banking, credit, investment, crypto, stored-value wallet, or money-transfer services.

Do not use a Personal developer account strategy unless you are willing to remove or fully disable the human impact/research features from the submitted app.

## Recommended Approval Path

1. Create or verify a legal Organization developer account in Play Console.
2. Complete organization identity verification, including the organization's legal name, address, website/contact details, and D-U-N-S information if Google requests it.
3. Transfer Lovedogs 360 from the current developer account to the Organization account, or publish the release from the Organization account if the app already belongs there.
4. In **Policy > App content**, answer declarations accurately:
   - Disclose the human impact/research/wellbeing scorecard features if the Health apps declaration asks about them.
   - Do not declare banking, lending, investment, crypto, stored-value wallet, or money transfer unless the app truly provides those regulated services.
   - Describe payments as Pesapal-hosted checkout for marketplace/event orders and seller payouts for completed Lovedogs 360 transactions.
   - Do not declare VPN or government services unless those features are actually present.
5. Update Data safety to reflect the data actually collected: account/contact info, location, photos/files, user-generated content, messages, pet records, order/payment status records, payout contact details, event registrations, scorecard answers, consent records, wellbeing/stress responses, diagnostics, and deletion flow.
6. Make sure the hosted privacy policy URL points to the updated policy and clearly explains program/impact/research data.
7. Provide reviewer app access credentials and a short note explaining how to find the scorecard/impact features.
8. Submit a new release from the Organization account or after the app transfer completes.

## Suggested Review Note

> Lovedogs 360 is a pet care, marketplace, events, lost/found, community coordination, and impact measurement platform. The app includes consent-based program scorecards, baseline/follow-up surveys, wellbeing/stress questions, impact tracking, and partner reporting for Lovedogs 360 programs. These features are for monitoring, evaluation, research, and program reporting, not diagnosis, prescriptions, treatment, emergency care, banking, lending, investment, cryptocurrency, stored-value wallet, VPN, or government services. Payments are processed through Pesapal hosted checkout for marketplace/event orders, and seller payout details are used only to pay sellers for completed Lovedogs 360 transactions.

## If You Appeal

Appeal only if the account is already an Organization developer account or if the declaration was clearly selected by mistake. If the app remains on a Personal developer account while keeping human impact/research features, an appeal is likely weaker than transferring or publishing from an Organization account.
