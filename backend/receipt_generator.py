"""
Receipt PDF Generator for Lovedogs 360
Uses reportlab to create a properly formatted order receipt PDF.
"""
import io
from datetime import datetime

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


def generate_receipt_pdf(order, service, buyer, provider):
    """Generate a PDF receipt for a paid order."""
    
    if not REPORTLAB_AVAILABLE:
        # Fallback: return minimal valid PDF if reportlab is not installed
        return b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"

    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    PRIMARY_COLOR = colors.HexColor("#4B0082")
    ACCENT_COLOR = colors.HexColor("#D4AF37")
    LIGHT_GRAY = colors.HexColor("#F5F5F5")
    DARK_GRAY = colors.HexColor("#333333")

    # Custom styles
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Title"],
        fontSize=26,
        textColor=PRIMARY_COLOR,
        spaceAfter=4,
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#888888"),
        alignment=TA_CENTER,
        spaceAfter=4,
    )
    section_header_style = ParagraphStyle(
        "SectionHeader",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.white,
        fontName="Helvetica-Bold",
        alignment=TA_LEFT,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=10,
        textColor=DARK_GRAY,
        spaceAfter=4,
        leading=16,
    )
    footer_style = ParagraphStyle(
        "Footer",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#999999"),
        alignment=TA_CENTER,
    )

    # --- Build content ---
    story = []

    # Logo / Branding
    story.append(Paragraph("🐾 Lovedogs 360", title_style))
    story.append(Paragraph("Official Order Receipt", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=ACCENT_COLOR, spaceAfter=12))

    # Order info header
    order_date = order.created_at.strftime("%B %d, %Y at %H:%M") if order.created_at else "N/A"
    story.append(Paragraph(f"<b>Order ID:</b> {order.id}", body_style))
    story.append(Paragraph(f"<b>Date:</b> {order_date}", body_style))
    story.append(Paragraph(f"<b>Status:</b> {'PAID ✓' if str(order.status).lower() in ['paid', 'completed', 'settled'] else str(order.status).upper()}", body_style))
    story.append(Spacer(1, 0.4 * cm))

    # Service details table
    service_title = service.title if service else "N/A"
    service_desc = (service.description[:80] + "...") if service and service.description and len(service.description) > 80 else (service.description or "N/A")
    provider_name = provider.full_name if provider else "N/A"
    provider_email = provider.email if provider else "N/A"

    section_data_service = [
        [Paragraph("SERVICE DETAILS", section_header_style)],
    ]
    service_section = Table(section_data_service, colWidths=["100%"])
    service_section.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY_COLOR),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(service_section)

    service_data = [
        ["Service Name:", service_title],
        ["Description:", service_desc],
        ["Provider:", provider_name],
        ["Provider Email:", provider_email],
    ]
    service_table = Table(service_data, colWidths=[4 * cm, None])
    service_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_GRAY),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, -1), DARK_GRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E0E0")),
    ]))
    story.append(service_table)
    story.append(Spacer(1, 0.4 * cm))

    # Buyer details
    buyer_name = buyer.full_name if buyer else "N/A"
    buyer_email = buyer.email if buyer else "N/A"
    buyer_phone = buyer.phone_number if buyer else "N/A"

    section_data_buyer = [[Paragraph("CUSTOMER DETAILS", section_header_style)]]
    buyer_section = Table(section_data_buyer, colWidths=["100%"])
    buyer_section.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY_COLOR),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(buyer_section)

    buyer_data = [
        ["Name:", buyer_name],
        ["Email:", buyer_email],
        ["Phone:", buyer_phone or "Not provided"],
    ]
    buyer_table = Table(buyer_data, colWidths=[4 * cm, None])
    buyer_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_GRAY),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, -1), DARK_GRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E0E0")),
    ]))
    story.append(buyer_table)
    story.append(Spacer(1, 0.4 * cm))

    # Payment breakdown
    gross = float(order.amount or 0)
    commission = float(order.commission or 0)
    payout = float(order.payout or 0)

    section_data_pay = [[Paragraph("PAYMENT BREAKDOWN", section_header_style)]]
    pay_section = Table(section_data_pay, colWidths=["100%"])
    pay_section.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY_COLOR),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(pay_section)

    pay_data = [
        ["Total Charged:", f"KES {gross:,.2f}"],
        ["Platform Fee (23.5%):", f"KES {commission:,.2f}"],
        ["Provider Payout:", f"KES {payout:,.2f}"],
    ]
    pay_table = Table(pay_data, colWidths=[5 * cm, None])
    pay_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_GRAY),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, -1), (-1, -1), PRIMARY_COLOR),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (-1, -1), DARK_GRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E0E0")),
        ("LINEABOVE", (0, -1), (-1, -1), 1.5, ACCENT_COLOR),
    ]))
    story.append(pay_table)

    # Footer
    story.append(Spacer(1, 1 * cm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E0E0E0"), spaceAfter=8))
    story.append(Paragraph("Thank you for using Lovedogs 360 — The World's #1 Dog Wellbeing Platform", footer_style))
    story.append(Paragraph(f"Generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC  •  lovedogs360.com", footer_style))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
