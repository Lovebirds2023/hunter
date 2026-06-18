"""
Receipt PDF generator for Lovedogs 360.
"""
import io
import os
from datetime import datetime
from xml.sax.saxutils import escape as xml_escape

try:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        HRFlowable,
        Image,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOGO_PATH = os.path.join(BASE_DIR, "assets", "lovedogs360-logo.png")


def _safe(value, default="N/A"):
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def _clip(value, limit=180):
    text = _safe(value)
    if len(text) <= limit:
        return text
    return f"{text[: limit - 3].rstrip()}..."


def _money(value):
    return f"KES {float(value or 0):,.2f}"


def _status_label(status):
    raw = str(status or "unknown").strip()
    if "." in raw:
        raw = raw.rsplit(".", 1)[-1]
    return raw.replace("_", " ").upper()


def _paid_status(status):
    return _status_label(status) in {"PAID", "COMPLETED", "SETTLED"}


def _p(value, style):
    return Paragraph(xml_escape(_safe(value)), style)


def _label_value(label, value, label_style, value_style):
    return [_p(label, label_style), _p(value, value_style)]


def _section_title(title, width, style, primary_color):
    section = Table([[Paragraph(xml_escape(title), style)]], colWidths=[width])
    section.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), primary_color),
        ("BOX", (0, 0), (-1, -1), 0.5, primary_color),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    return section


def _draw_page_brand(canvas, doc):
    primary_color = colors.HexColor("#3B145F")
    accent_color = colors.HexColor("#D4AF37")
    muted_color = colors.HexColor("#777777")
    page_width, page_height = A4

    canvas.saveState()
    canvas.setStrokeColor(accent_color)
    canvas.setLineWidth(0.75)
    canvas.line(doc.leftMargin, page_height - 1.35 * cm, page_width - doc.rightMargin, page_height - 1.35 * cm)

    if os.path.exists(LOGO_PATH):
        canvas.drawImage(
            LOGO_PATH,
            doc.leftMargin,
            page_height - 1.18 * cm,
            width=1.05 * cm,
            height=0.7 * cm,
            preserveAspectRatio=True,
            mask="auto",
        )

    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(primary_color)
    canvas.drawString(doc.leftMargin + 1.25 * cm, page_height - 0.86 * cm, "LOVEDOGS 360")

    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(muted_color)
    canvas.drawRightString(page_width - doc.rightMargin, 0.85 * cm, f"Page {doc.page}")
    canvas.drawString(doc.leftMargin, 0.85 * cm, "Official Lovedogs 360 receipt")
    canvas.restoreState()


def generate_receipt_pdf(order, service, buyer, provider):
    """Generate a branded PDF receipt for a paid order."""

    if not REPORTLAB_AVAILABLE:
        return (
            b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
            b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
            b"trailer\n<< /Root 1 0 R >>\n%%EOF"
        )

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.7 * cm,
        leftMargin=1.7 * cm,
        topMargin=2.2 * cm,
        bottomMargin=1.5 * cm,
        title=f"Lovedogs 360 Receipt {order.id}",
        author="Lovedogs 360",
    )

    styles = getSampleStyleSheet()
    primary_color = colors.HexColor("#3B145F")
    accent_color = colors.HexColor("#D4AF37")
    ink_color = colors.HexColor("#222222")
    muted_color = colors.HexColor("#666666")
    soft_panel = colors.HexColor("#F8F6FB")
    soft_gold = colors.HexColor("#FFF7DF")
    rule_color = colors.HexColor("#E7E1EE")
    success_color = colors.HexColor("#1F7A4D")

    brand_style = ParagraphStyle(
        "Brand",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=primary_color,
        alignment=TA_CENTER,
        spaceAfter=2,
    )
    receipt_style = ParagraphStyle(
        "ReceiptLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=muted_color,
        alignment=TA_CENTER,
        spaceAfter=8,
    )
    section_style = ParagraphStyle(
        "Section",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        textColor=colors.white,
        alignment=TA_LEFT,
    )
    label_style = ParagraphStyle(
        "Label",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=muted_color,
    )
    value_style = ParagraphStyle(
        "Value",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=ink_color,
    )
    value_bold_style = ParagraphStyle(
        "ValueBold",
        parent=value_style,
        fontName="Helvetica-Bold",
        textColor=primary_color,
    )
    amount_style = ParagraphStyle(
        "Amount",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=19,
        leading=23,
        textColor=primary_color,
        alignment=TA_RIGHT,
    )
    note_style = ParagraphStyle(
        "Note",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=muted_color,
        alignment=TA_CENTER,
    )

    story = []
    content_width = doc.width
    order_date = order.created_at.strftime("%B %d, %Y at %H:%M") if order.created_at else "N/A"
    generated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    status_label = _status_label(order.status)
    status_color = "#1F7A4D" if _paid_status(order.status) else "#3B145F"

    if os.path.exists(LOGO_PATH):
        logo = Image(LOGO_PATH, width=5.1 * cm, height=3.4 * cm)
        logo.hAlign = "CENTER"
        story.append(logo)
        story.append(Spacer(1, 0.1 * cm))

    story.append(Paragraph("LOVEDOGS 360", brand_style))
    story.append(Paragraph("Official Order Receipt", receipt_style))
    story.append(HRFlowable(width="100%", thickness=1.4, color=accent_color, spaceAfter=10))

    meta_left = [
        Paragraph("RECEIPT", label_style),
        Paragraph(xml_escape(_safe(order.id)), value_bold_style),
        Spacer(1, 0.12 * cm),
        Paragraph("ISSUED", label_style),
        Paragraph(xml_escape(order_date), value_style),
    ]
    meta_right = [
        Paragraph("AMOUNT PAID", label_style),
        Paragraph(_money(order.amount), amount_style),
        Spacer(1, 0.12 * cm),
        Paragraph("STATUS", label_style),
        Paragraph(f'<font color="{status_color}"><b>{xml_escape(status_label)}</b></font>', value_style),
    ]
    meta_table = Table([[meta_left, meta_right]], colWidths=[content_width * 0.58, content_width * 0.42])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), soft_gold),
        ("BOX", (0, 0), (-1, -1), 0.75, accent_color),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 0.45 * cm))

    service_title = _safe(getattr(service, "title", None), "Marketplace item")
    item_type = _safe(getattr(service, "item_type", None), "Listing").replace("_", " ").title()
    service_desc = _clip(getattr(service, "description", None), 220)
    provider_name = _safe(getattr(provider, "full_name", None), "Seller")
    provider_email = _safe(getattr(provider, "email", None), "Not provided")
    buyer_name = _safe(getattr(buyer, "full_name", None), "Customer")
    buyer_email = _safe(getattr(buyer, "email", None), "Not provided")
    buyer_phone = _safe(getattr(buyer, "phone_number", None), "Not provided")

    story.append(_section_title("ORDER DETAILS", content_width, section_style, primary_color))
    order_rows = [
        _label_value("Item", service_title, label_style, value_bold_style),
        _label_value("Type", item_type, label_style, value_style),
        _label_value("Description", service_desc, label_style, value_style),
    ]
    order_table = Table(order_rows, colWidths=[4.1 * cm, content_width - 4.1 * cm])
    order_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BACKGROUND", (0, 0), (0, -1), soft_panel),
        ("BOX", (0, 0), (-1, -1), 0.5, rule_color),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, rule_color),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(order_table)
    story.append(Spacer(1, 0.35 * cm))

    story.append(_section_title("PARTIES", content_width, section_style, primary_color))
    party_table = Table([
        [
            [
                Paragraph("CUSTOMER", label_style),
                Paragraph(xml_escape(buyer_name), value_bold_style),
                Paragraph(xml_escape(buyer_email), value_style),
                Paragraph(xml_escape(buyer_phone), value_style),
            ],
            [
                Paragraph("SELLER", label_style),
                Paragraph(xml_escape(provider_name), value_bold_style),
                Paragraph(xml_escape(provider_email), value_style),
            ],
        ]
    ], colWidths=[content_width / 2, content_width / 2])
    party_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, rule_color),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, rule_color),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(party_table)
    story.append(Spacer(1, 0.35 * cm))

    gross = float(order.amount or 0)
    discount = float(getattr(order, "discount_amount", 0) or 0)
    points_redeemed = int(getattr(order, "karma_points_redeemed", 0) or 0)
    listing_total = gross + discount
    commission = float(order.commission or 0)
    payout = float(order.payout or 0)

    story.append(_section_title("PAYMENT SUMMARY", content_width, section_style, primary_color))
    payment_rows = [
        [_p("Listing price", value_style), Paragraph(_money(listing_total), value_style)],
    ]
    if discount > 0:
        payment_rows.append([
            _p(f"Points discount ({points_redeemed} points)", value_style),
            Paragraph(f"-{_money(discount)}", value_style),
        ])
    payment_rows.extend([
        [_p("Total charged", value_bold_style), Paragraph(_money(gross), value_bold_style)],
        [_p("Platform fee", value_style), Paragraph(_money(commission), value_style)],
        [_p("Seller payout", value_style), Paragraph(_money(payout), value_style)],
    ])
    payment_table = Table(payment_rows, colWidths=[content_width * 0.62, content_width * 0.38])
    payment_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, rule_color),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, rule_color),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 2 if discount > 0 else 1), (-1, 2 if discount > 0 else 1), soft_gold),
        ("LINEABOVE", (0, 2 if discount > 0 else 1), (-1, 2 if discount > 0 else 1), 1.0, accent_color),
    ]))
    story.append(payment_table)
    story.append(Spacer(1, 0.45 * cm))

    note_table = Table([[
        Paragraph(
            "This receipt confirms a Lovedogs 360 marketplace payment. "
            f"Generated on {xml_escape(generated_at)}.",
            note_style,
        )
    ]], colWidths=[content_width])
    note_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), soft_panel),
        ("BOX", (0, 0), (-1, -1), 0.5, rule_color),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(note_table)

    doc.build(story, onFirstPage=_draw_page_brand, onLaterPages=_draw_page_brand)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
