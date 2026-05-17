// src/services/emailService.js
import nodemailer from 'nodemailer';
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL;
const STORE_URL    = 'https://vintage808.co.za';
const YEAR         = new Date().getFullYear();
const SHIPPING_FEE = 150;

// ── Send helper ───────────────────────────────────────────────

// ── Send helper ───────────────────────────────────────────────
async function send({ to, subject, html, replyTo }) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;

  if (!user || !pass) {
    console.warn('[Email] Skipped — GMAIL_USER or GMAIL_PASS not set');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  try {
    const info = await transporter.sendMail({
      from:     `Vintage808 <${user}>`,
      to,
      subject,
      html,
      ...(replyTo && { replyTo }),
    });
    console.log(`[Email] Sent: ${subject} → ${to} (${info.messageId})`);
  } catch (err) {
    console.error('[Email] Failed:', err.message);
  }
}
// ── Shared layout ─────────────────────────────────────────────
function layout(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Vintage808</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:#111111;padding:28px 40px;text-align:center;">
            <span style="font-family:'Helvetica Neue',sans-serif;font-size:22px;font-weight:900;letter-spacing:4px;color:#ffffff;text-transform:uppercase;">
              VINTAGE<span style="color:#c84b2f;">808</span>
            </span>
          </td>
        </tr>
        ${content}
        <tr>
          <td style="background:#111111;padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding-bottom:16px;">
                  <a href="${STORE_URL}/shop.html" style="color:#ffffff;text-decoration:none;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 12px;">Shop</a>
                  <span style="color:#444;font-size:11px;">|</span>
                  <a href="${STORE_URL}/account.html" style="color:#ffffff;text-decoration:none;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 12px;">Account</a>
                  <span style="color:#444;font-size:11px;">|</span>
                  <a href="${STORE_URL}/contact.html" style="color:#ffffff;text-decoration:none;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 12px;">Contact</a>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:10px;">
                  <span style="color:#555555;font-size:11px;">© ${YEAR} Vintage808. All rights reserved.</span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <a href="mailto:customersupport@vintage808info.com" style="color:#666;font-size:11px;text-decoration:none;">customersupport@vintage808info.com</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Reusable item rows HTML ───────────────────────────────────
function buildItemsHTML(items = []) {
  return items.map(item => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #f0f0f0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="80" style="vertical-align:top;">
            ${item.image
              ? `<img src="${item.image}" width="72" height="86" style="display:block;object-fit:cover;border-radius:2px;background:#f5f5f5;" />`
              : `<div style="width:72px;height:86px;background:#f0ede8;border-radius:2px;"></div>`}
          </td>
          <td style="padding-left:16px;vertical-align:top;">
            <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111111;">${item.name}</p>
            <p style="margin:0 0 8px;font-size:12px;color:#888888;">
              ${item.size && item.size !== '—' ? `Size: ${item.size} &nbsp;·&nbsp; ` : ''}Qty: ${item.quantity || 1}
            </p>
            <p style="margin:0;font-size:14px;font-weight:700;color:#111111;font-family:monospace;">
              R${(Number(item.price) * (item.quantity || 1)).toFixed(2)}
            </p>
          </td>
        </tr></table>
      </td>
    </tr>`).join('');
}

// ── Email stepper (for shipped / delivered) ───────────────────
function buildStepperHTML(activeStep) {
  const steps = [
    { key: 'ordered', label: 'Ordered' },
    { key: 'packed',  label: 'Packed'  },
    { key: 'shipped', label: 'Shipped' },
    { key: 'delivered', label: 'Delivered' },
  ];
  const activeIdx = steps.findIndex(s => s.key === activeStep);

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 40px;max-width:420px;">
      <tr>
        ${steps.map((step, i) => {
          const done    = i < activeIdx;
          const current = i === activeIdx;
          const future  = i > activeIdx;
          const dotBg   = done ? '#111' : current ? '#c84b2f' : '#dddddd';
          const dotContent = done
            ? `<span style="color:#fff;font-size:12px;">✓</span>`
            : current
              ? `<span style="font-size:14px;">${step.key === 'shipped' ? '🚚' : step.key === 'delivered' ? '📦' : '●'}</span>`
              : `<span style="font-size:14px;color:#aaa">●</span>`;
          const labelColor = current ? '#c84b2f' : done ? '#888' : '#aaaaaa';
          const labelWeight = current ? '700' : '400';

          const separator = i < steps.length - 1
            ? `<td style="border-top:2px solid ${done ? '#111' : current ? '#c84b2f' : '#dddddd'};vertical-align:middle;padding-bottom:20px;"></td>`
            : '';

          return `
            <td align="center" width="22%">
              <div style="width:28px;height:28px;background:${dotBg};border-radius:50%;margin:0 auto 8px;line-height:28px;text-align:center;">${dotContent}</div>
              <span style="font-size:10px;color:${labelColor};font-weight:${labelWeight};text-transform:uppercase;letter-spacing:1px;">${step.label}</span>
            </td>
            ${separator}`;
        }).join('')}
      </tr>
    </table>`;
}

/* ═══════════════════════════════════════════════════════════
   1. WELCOME EMAIL
═══════════════════════════════════════════════════════════ */
export async function sendWelcomeEmail(user) {
  await send({
    to:      user.email,
    subject: `Welcome to Vintage808, ${user.name.split(' ')[0]}.`,
    html: layout(`
      <tr>
        <td style="background:#c84b2f;padding:48px 40px;text-align:center;">
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.7);">You're in.</p>
          <h1 style="margin:0;font-size:36px;font-weight:900;color:#ffffff;letter-spacing:-1px;line-height:1.1;">Welcome to<br/>the crew.</h1>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:48px 40px;">
          <p style="margin:0 0 16px;font-size:16px;color:#111111;line-height:1.7;">Hey <strong>${user.name.split(' ')[0]}</strong>,</p>
          <p style="margin:0 0 32px;font-size:15px;color:#444444;line-height:1.8;">
            Your Vintage808 account is live. Browse our latest drops and check out when you're ready.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:40px;">
            <tr><td style="padding:12px 0;border-bottom:1px solid #f5f5f5;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="32" style="font-size:20px;vertical-align:middle;">👕</td>
                <td style="padding-left:16px;vertical-align:middle;">
                  <span style="font-size:13px;font-weight:700;color:#111;text-transform:uppercase;letter-spacing:0.5px;">Premium streetwear</span><br/>
                  <span style="font-size:12px;color:#888;">Tees and shorts — built to last.</span>
                </td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid #f5f5f5;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="32" style="font-size:20px;vertical-align:middle;">🚚</td>
                <td style="padding-left:16px;vertical-align:middle;">
                  <span style="font-size:13px;font-weight:700;color:#111;text-transform:uppercase;letter-spacing:0.5px;">Nationwide shipping — R${SHIPPING_FEE}</span><br/>
                  <span style="font-size:12px;color:#888;">Flat rate, delivered across South Africa.</span>
                </td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:12px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="32" style="font-size:20px;vertical-align:middle;">🔒</td>
                <td style="padding-left:16px;vertical-align:middle;">
                  <span style="font-size:13px;font-weight:700;color:#111;text-transform:uppercase;letter-spacing:0.5px;">Secure checkout</span><br/>
                  <span style="font-size:12px;color:#888;">Powered by PayFast. Your data is safe.</span>
                </td>
              </tr></table>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="center">
              <a href="${STORE_URL}/shop.html" style="display:inline-block;background:#111111;color:#ffffff;padding:16px 48px;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
                SHOP NOW
              </a>
            </td>
          </tr></table>
        </td>
      </tr>
    `),
  });
}

/* ═══════════════════════════════════════════════════════════
   2. ORDER CONFIRMATION / INVOICE
   Fires from payfastRoutes on ITN COMPLETE (not on order creation)
═══════════════════════════════════════════════════════════ */
export async function sendOrderConfirmation(order, userEmail) {
  const orderId   = order.orderNumber || ('#' + (order._id || order.id).toString().slice(-6).toUpperCase());
  const firstName = order.customerName?.split(' ')[0] || 'there';
  const shipping  = Number(order.shippingFee ?? SHIPPING_FEE);
  const subtotal  = Number(order.subtotal ?? order.total);
  const total     = Number(order.total);
  const addr      = order.shippingAddress || {};
  const addrLine  = [addr.street, addr.city, addr.province, addr.postal].filter(Boolean).join(', ');

  await send({
    to:      userEmail,
    subject: `Order confirmed — ${orderId}`,
    html: layout(`
      <tr>
        <td style="background:#111111;padding:40px;text-align:center;border-bottom:3px solid #c84b2f;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#888888;">Order Confirmed</p>
          <h1 style="margin:0;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Thanks, ${firstName}.</h1>
          <p style="margin:12px 0 0;font-size:13px;color:#888888;letter-spacing:1px;">${orderId}</p>
        </td>
      </tr>
      <tr>
        <td style="background:#c84b2f;padding:14px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffffff;">
            ✓ &nbsp; Payment received &nbsp;·&nbsp; We'll get this packed for you
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:40px;">
          <p style="margin:0 0 20px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#111111;border-bottom:2px solid #111;padding-bottom:12px;">Your Items</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">${buildItemsHTML(order.items)}</table>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;"><tr><td style="padding:16px 0 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:13px;color:#888;padding:7px 0;">Subtotal</td>
                <td align="right" style="font-size:13px;color:#888;padding:7px 0;font-family:monospace;">R${subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#888;padding:7px 0;">Shipping (flat rate)</td>
                <td align="right" style="font-size:13px;color:#888;padding:7px 0;font-family:monospace;">R${shipping.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="font-size:16px;font-weight:900;color:#111;padding:14px 0 0;border-top:2px solid #111;text-transform:uppercase;letter-spacing:1px;">Total Paid</td>
                <td align="right" style="font-size:18px;font-weight:900;color:#111;padding:14px 0 0;border-top:2px solid #111;font-family:monospace;">R${total.toFixed(2)}</td>
              </tr>
            </table>
          </td></tr></table>
          ${addrLine ? `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;"><tr>
            <td style="padding:16px 20px;background:#f9f9f9;border-left:4px solid #111111;">
              <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#888;">Delivery Address</p>
              <p style="margin:0;font-size:13px;color:#111;line-height:1.7;">${order.customerName || ''}<br/>${addrLine}${addr.phone ? '<br/>' + addr.phone : ''}</p>
            </td>
          </tr></table>` : ''}
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;background:#f9f9f9;border-left:4px solid #c84b2f;"><tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c84b2f;">What happens next?</p>
              <p style="margin:0;font-size:13px;color:#555555;line-height:1.7;">
                We're packing your order now. You'll get a shipping confirmation with tracking details as soon as it's on its way.
                Questions? <a href="mailto:customersupport@vintage808info.com" style="color:#c84b2f;">Reply to this email</a>.
              </p>
            </td>
          </tr></table>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;"><tr>
            <td>
              <a href="${STORE_URL}/account.html" style="display:inline-block;background:#111111;color:#ffffff;padding:14px 32px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-right:12px;">TRACK ORDER</a>
              <a href="${STORE_URL}/shop.html" style="display:inline-block;background:#ffffff;color:#111111;padding:13px 32px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border:1px solid #111111;">SHOP MORE</a>
            </td>
          </tr></table>
        </td>
      </tr>
    `),
  });
}

/* ═══════════════════════════════════════════════════════════
   3. ORDER SHIPPED
═══════════════════════════════════════════════════════════ */
export async function sendOrderShipped(order, userEmail) {
  const orderId   = order.orderNumber || ('#' + (order._id || order.id).toString().slice(-6).toUpperCase());
  const firstName = order.customerName?.split(' ')[0] || 'there';
  const courier   = order.tracking?.courier || '';
  const trackNum  = order.tracking?.number  || '';
  const trackUrl  = order.tracking?.url     || `${STORE_URL}/account.html`;
  const eta       = order.estimatedDelivery
    ? new Date(order.estimatedDelivery).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })
    : '3–5 business days';

  await send({
    to:      userEmail,
    subject: `Your order ${orderId} is on its way 🚚`,
    html: layout(`
      <tr>
        <td style="background:#111111;padding:48px 40px;text-align:center;">
          <div style="font-size:52px;margin-bottom:16px;">🚚</div>
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#888888;">${orderId}</p>
          <h1 style="margin:0;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">It's on its way,<br/>${firstName}.</h1>
        </td>
      </tr>
      <tr>
        <td style="background:#c84b2f;padding:14px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffffff;">
            🚀 &nbsp; Shipped &nbsp;·&nbsp; Expected: ${eta}
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:48px 40px;">
          <p style="margin:0 0 32px;font-size:15px;color:#444444;line-height:1.8;text-align:center;">
            Your order has left our hands and is heading your way.
          </p>
          ${trackNum ? `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:40px;background:#f9f9f9;border:1px solid #e8e8e8;border-left:4px solid #c84b2f;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#888;">Tracking Details</p>
              ${courier ? `<p style="margin:0 0 4px;font-size:13px;color:#555;">${courier}</p>` : ''}
              <p style="margin:0 0 12px;font-size:18px;font-weight:900;color:#111;font-family:monospace;letter-spacing:2px;">${trackNum}</p>
              <a href="${trackUrl}" style="display:inline-block;background:#111;color:#fff;padding:10px 24px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">TRACK PARCEL</a>
            </td></tr>
          </table>` : ''}
          ${buildStepperHTML('shipped')}
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="center">
              <a href="${STORE_URL}/account.html" style="display:inline-block;background:#111111;color:#ffffff;padding:16px 48px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">VIEW ORDER</a>
            </td>
          </tr></table>
        </td>
      </tr>
    `),
  });
}

/* ═══════════════════════════════════════════════════════════
   4. ORDER DELIVERED
═══════════════════════════════════════════════════════════ */
export async function sendOrderDelivered(order, userEmail) {
  const orderId   = order.orderNumber || ('#' + (order._id || order.id).toString().slice(-6).toUpperCase());
  const firstName = order.customerName?.split(' ')[0] || 'there';

  await send({
    to:      userEmail,
    subject: `Your order ${orderId} has been delivered 📦`,
    html: layout(`
      <tr>
        <td style="background:#111111;padding:48px 40px;text-align:center;">
          <div style="font-size:52px;margin-bottom:16px;">📦</div>
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#888888;">${orderId}</p>
          <h1 style="margin:0;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Delivered, ${firstName}.</h1>
        </td>
      </tr>
      <tr>
        <td style="background:#166534;padding:14px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffffff;">✓ &nbsp; Your order has arrived</p>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:48px 40px;text-align:center;">
          <p style="margin:0 0 32px;font-size:15px;color:#444444;line-height:1.8;max-width:420px;margin-left:auto;margin-right:auto;">
            We hope you love it! If anything isn't right, reply to this email within <strong>7 days</strong> and we'll sort it out.
          </p>
          ${buildStepperHTML('delivered')}
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr>
            <td align="center">
              <a href="${STORE_URL}/shop.html" style="display:inline-block;background:#111111;color:#ffffff;padding:16px 48px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-right:12px;">SHOP AGAIN</a>
              <a href="mailto:customersupport@vintage808info.com" style="display:inline-block;background:#ffffff;color:#111111;padding:15px 32px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border:1px solid #111;">NEED HELP?</a>
            </td>
          </tr></table>
          <p style="margin:0;font-size:12px;color:#aaaaaa;">
            Not happy? Email <a href="mailto:customersupport@vintage808info.com" style="color:#c84b2f;">customersupport@vintage808info.com</a> within 7 days.
          </p>
        </td>
      </tr>
    `),
  });
}

/* ═══════════════════════════════════════════════════════════
   5. ORDER CANCELLED
   Call when admin cancels an order or when payment definitively fails
═══════════════════════════════════════════════════════════ */
export async function sendOrderCancelled(order, userEmail, { reason = '', refundExpected = false } = {}) {
  const orderId   = order.orderNumber || ('#' + (order._id || order.id).toString().slice(-6).toUpperCase());
  const firstName = order.customerName?.split(' ')[0] || 'there';
  const total     = Number(order.total);

  await send({
    to:      userEmail,
    subject: `Your order ${orderId} has been cancelled`,
    html: layout(`
      <tr>
        <td style="background:#111111;padding:48px 40px;text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">❌</div>
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#888888;">${orderId}</p>
          <h1 style="margin:0;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Order Cancelled</h1>
        </td>
      </tr>
      <tr>
        <td style="background:#991b1b;padding:14px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffffff;">
            Your order has been cancelled
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:48px 40px;">
          <p style="margin:0 0 24px;font-size:15px;color:#444444;line-height:1.8;">
            Hey <strong>${firstName}</strong>, we're sorry to let you know that your order <strong>${orderId}</strong> has been cancelled.
          </p>

          ${reason ? `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #991b1b;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#991b1b;">Reason</p>
              <p style="margin:0;font-size:13px;color:#444;line-height:1.7;">${reason}</p>
            </td></tr>
          </table>` : ''}

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
            <tr style="background:#f9f9f9;">
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Order</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;font-family:monospace;">${orderId}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Items</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;">${(order.items || []).length} item(s)</td>
            </tr>
            <tr style="background:#f9f9f9;">
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Order Total</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;font-family:monospace;">R${total.toFixed(2)}</td>
            </tr>
          </table>

          ${refundExpected ? `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #166534;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#166534;">Refund</p>
              <p style="margin:0;font-size:13px;color:#444;line-height:1.7;">
                A refund of <strong>R${total.toFixed(2)}</strong> will be processed to your original payment method within <strong>5–10 business days</strong>.
              </p>
            </td></tr>
          </table>` : ''}

          <p style="margin:0 0 32px;font-size:13px;color:#888;line-height:1.8;">
            Questions? Reply to this email or contact us at
            <a href="mailto:customersupport@vintage808info.com" style="color:#c84b2f;">customersupport@vintage808info.com</a>.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td>
              <a href="${STORE_URL}/shop.html" style="display:inline-block;background:#111111;color:#ffffff;padding:14px 32px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-right:12px;">SHOP AGAIN</a>
              <a href="mailto:customersupport@vintage808info.com" style="display:inline-block;background:#ffffff;color:#111111;padding:13px 32px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border:1px solid #111111;">CONTACT US</a>
            </td>
          </tr></table>
        </td>
      </tr>
    `),
  });
}

/* ═══════════════════════════════════════════════════════════
   6. RETURN SUBMITTED — customer acknowledgement
   Fire this immediately when the customer submits a return request
═══════════════════════════════════════════════════════════ */
export async function sendReturnReceived(order, userEmail) {
  const orderId   = order.orderNumber || ('#' + (order._id || order.id).toString().slice(-6).toUpperCase());
  const firstName = order.customerName?.split(' ')[0] || 'there';
  const reason    = order.return?.reason || '';

  await send({
    to:      userEmail,
    subject: `We received your return request — ${orderId}`,
    html: layout(`
      <tr>
        <td style="background:#111111;padding:48px 40px;text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">📬</div>
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#888888;">${orderId}</p>
          <h1 style="margin:0;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Return Request<br/>Received</h1>
        </td>
      </tr>
      <tr>
        <td style="background:#c84b2f;padding:14px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffffff;">
            ✓ &nbsp; We've got your request — we'll be in touch within 2 business days
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:48px 40px;">
          <p style="margin:0 0 24px;font-size:15px;color:#444444;line-height:1.8;">
            Hey <strong>${firstName}</strong>, we've received your return request for order <strong>${orderId}</strong>.
            Our team will review it and get back to you within <strong>2 business days</strong>.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
            <tr style="background:#f9f9f9;">
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Order</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;font-family:monospace;">${orderId}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Your Reason</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;">${reason || '—'}</td>
            </tr>
            <tr style="background:#f9f9f9;">
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Status</td>
              <td align="right" style="padding:12px 16px;font-size:13px;font-weight:700;color:#854d0e;">Under Review</td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;background:#fef9c3;border:1px solid #fde68a;border-left:4px solid #d97706;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#854d0e;">Please Note</p>
              <p style="margin:0;font-size:13px;color:#444;line-height:1.7;">
                Do <strong>not</strong> send anything back yet. Wait for our approval email before returning any items.
                Unauthorised returns will not be accepted.
              </p>
            </td></tr>
          </table>

          <p style="margin:0;font-size:13px;color:#888;line-height:1.8;">
            Questions? Reply to this email or contact
            <a href="mailto:customersupport@vintage808info.com" style="color:#c84b2f;">customersupport@vintage808info.com</a>.
          </p>
        </td>
      </tr>
    `),
  });
}

/* ═══════════════════════════════════════════════════════════
   7. RETURN SUBMITTED — admin alert
   Fire alongside sendReturnReceived so admin knows immediately
═══════════════════════════════════════════════════════════ */
export async function sendAdminReturnAlert(order, userEmail) {
  if (!ADMIN_EMAIL) return;
  const orderId = order.orderNumber || ('#' + (order._id || order.id).toString().slice(-6).toUpperCase());
  const reason  = order.return?.reason || '—';

  await send({
    to:      ADMIN_EMAIL,
    subject: `🔄 Return request — ${orderId} — action needed`,
    html: layout(`
      <tr>
        <td style="background:#111111;padding:32px 40px;border-bottom:3px solid #c84b2f;">
          <p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#888888;">Admin Alert</p>
          <h1 style="margin:0;font-size:28px;font-weight:900;color:#ffffff;">Return Request Received</h1>
          <p style="margin:8px 0 0;font-size:13px;color:#888888;letter-spacing:1px;">${orderId}</p>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:40px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr style="background:#f9f9f9;">
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Customer</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;font-weight:700;">${order.customerName || '—'}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Email</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;">${userEmail}</td>
            </tr>
            <tr style="background:#f9f9f9;">
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Order</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;font-family:monospace;">${orderId}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Order Total</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;font-family:monospace;">R${Number(order.total).toFixed(2)}</td>
            </tr>
            <tr style="background:#fef9c3;">
              <td style="padding:12px 16px;font-size:12px;color:#854d0e;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Reason</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#854d0e;font-weight:700;">${reason}</td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;"><tr>
            <td>
              <a href="https://vintage808-admin.vercel.app" style="display:inline-block;background:#c84b2f;color:#ffffff;padding:14px 40px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
                REVIEW IN ADMIN
              </a>
            </td>
          </tr></table>
        </td>
      </tr>
    `),
  });
}

/* ═══════════════════════════════════════════════════════════
   8. RETURN RESOLUTION — approved or rejected
   Replaces the old sendReturnResolution
═══════════════════════════════════════════════════════════ */
export async function sendReturnResolution(order, userEmail) {
  const orderId   = order.orderNumber || ('#' + (order._id || order.id).toString().slice(-6).toUpperCase());
  const firstName = order.customerName?.split(' ')[0] || 'there';
  const ret       = order.return || {};
  const approved  = ret.status === 'approved';
  const total     = Number(order.total);

  await send({
    to:      userEmail,
    subject: `Your return request for ${orderId} has been ${ret.status}`,
    html: layout(`
      <tr>
        <td style="background:#111111;padding:48px 40px;text-align:center;">
          <div style="font-size:52px;margin-bottom:16px;">${approved ? '✅' : '❌'}</div>
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#888888;">${orderId}</p>
          <h1 style="margin:0;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
            Return ${approved ? 'Approved' : 'Rejected'}
          </h1>
        </td>
      </tr>
      <tr>
        <td style="background:${approved ? '#166534' : '#991b1b'};padding:14px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffffff;">
            ${approved ? '✓ &nbsp; Your return has been approved' : '✕ &nbsp; Your return request was not approved'}
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:48px 40px;">
          <p style="margin:0 0 24px;font-size:15px;color:#444444;line-height:1.8;">Hey <strong>${firstName}</strong>,</p>
          ${approved ? `
          <p style="margin:0 0 32px;font-size:15px;color:#444444;line-height:1.8;">
            We've approved your return for order <strong>${orderId}</strong>. Please follow the steps below.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #166534;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#166534;">Next Steps</p>
              <ol style="margin:0;padding-left:20px;font-size:13px;color:#444;line-height:2;">
                <li>Pack your item(s) securely in the original packaging if possible.</li>
                <li>Email us at <a href="mailto:customersupport@vintage808info.com" style="color:#166534;">customersupport@vintage808info.com</a> to get our return address.</li>
                <li>Ship within <strong>7 days</strong> of this email.</li>
                <li>Once received and inspected, your refund of <strong>R${total.toFixed(2)}</strong> will be processed within 5–10 business days.</li>
              </ol>
            </td></tr>
          </table>` : `
          <p style="margin:0 0 32px;font-size:15px;color:#444444;line-height:1.8;">
            Unfortunately we were unable to approve your return for order <strong>${orderId}</strong>.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #991b1b;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#991b1b;">Reason</p>
              <p style="margin:0;font-size:13px;color:#444;line-height:1.7;">
                ${ret.adminNote || 'This return did not meet our return policy requirements.'}
              </p>
            </td></tr>
          </table>
          <p style="margin:0 0 32px;font-size:13px;color:#888;line-height:1.8;">
            If you believe this is an error, reply to this email and our team will review it.
          </p>`}

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:40px;">
            <tr style="background:#f9f9f9;">
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Order</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;font-family:monospace;">${orderId}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Your Reason</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;">${ret.reason || '—'}</td>
            </tr>
            <tr style="background:#f9f9f9;">
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Decision</td>
              <td align="right" style="padding:12px 16px;font-size:13px;font-weight:700;color:${approved ? '#166534' : '#991b1b'};">
                ${approved ? 'Approved' : 'Rejected'}
              </td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td>
              <a href="${STORE_URL}/account.html" style="display:inline-block;background:#111111;color:#ffffff;padding:14px 32px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-right:12px;">VIEW ORDER</a>
              <a href="mailto:customersupport@vintage808info.com" style="display:inline-block;background:#ffffff;color:#111111;padding:13px 32px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border:1px solid #111111;">CONTACT US</a>
            </td>
          </tr></table>
        </td>
      </tr>
    `),
  });
}

/* ═══════════════════════════════════════════════════════════
   9. REFUND PROCESSED
   Fire when a refund is manually processed
═══════════════════════════════════════════════════════════ */
export async function sendRefundProcessed(order, userEmail, { refundAmount, refundMethod = 'original payment method' } = {}) {
  const orderId   = order.orderNumber || ('#' + (order._id || order.id).toString().slice(-6).toUpperCase());
  const firstName = order.customerName?.split(' ')[0] || 'there';
  const amount    = refundAmount ?? Number(order.total);

  await send({
    to:      userEmail,
    subject: `Refund of R${Number(amount).toFixed(2)} processed — ${orderId}`,
    html: layout(`
      <tr>
        <td style="background:#111111;padding:48px 40px;text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">💸</div>
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#888888;">${orderId}</p>
          <h1 style="margin:0;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Refund Processed</h1>
        </td>
      </tr>
      <tr>
        <td style="background:#166534;padding:14px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffffff;">
            ✓ &nbsp; R${Number(amount).toFixed(2)} is on its way back to you
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:48px 40px;">
          <p style="margin:0 0 24px;font-size:15px;color:#444444;line-height:1.8;">
            Hey <strong>${firstName}</strong>, your refund for order <strong>${orderId}</strong> has been processed.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #166534;">
            <tr><td style="padding:24px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#166534;">Refund Amount</p>
              <p style="margin:0;font-size:32px;font-weight:900;color:#166534;font-family:monospace;">R${Number(amount).toFixed(2)}</p>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
            <tr style="background:#f9f9f9;">
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Order</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;font-family:monospace;">${orderId}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Refund to</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;">${refundMethod}</td>
            </tr>
            <tr style="background:#f9f9f9;">
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Timeline</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;">5–10 business days</td>
            </tr>
          </table>

          <p style="margin:0 0 32px;font-size:13px;color:#888;line-height:1.8;">
            The refund may take 5–10 business days to appear depending on your bank. If you don't see it after 10 days,
            please contact us at <a href="mailto:customersupport@vintage808info.com" style="color:#c84b2f;">customersupport@vintage808info.com</a>.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td>
              <a href="${STORE_URL}/shop.html" style="display:inline-block;background:#111111;color:#ffffff;padding:14px 32px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-right:12px;">SHOP AGAIN</a>
              <a href="mailto:customersupport@vintage808info.com" style="display:inline-block;background:#ffffff;color:#111111;padding:13px 32px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border:1px solid #111111;">CONTACT US</a>
            </td>
          </tr></table>
        </td>
      </tr>
    `),
  });
}

/* ═══════════════════════════════════════════════════════════
   10. ABANDONED CART RECOVERY
   Call from a cron job — finds orders stuck in 'pending'
   for 60+ minutes with no payment
═══════════════════════════════════════════════════════════ */
export async function sendAbandonedCart(order, userEmail) {
  const firstName = order.customerName?.split(' ')[0] || 'there';
  const total     = Number(order.total);
  const orderId   = order.orderNumber || ('#' + (order._id || order.id).toString().slice(-6).toUpperCase());

  const itemsPreview = (order.items || []).slice(0, 2).map(item => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="56" style="vertical-align:top;">
            ${item.image
              ? `<img src="${item.image}" width="48" height="56" style="display:block;object-fit:cover;border-radius:2px;background:#f5f5f5;" />`
              : `<div style="width:48px;height:56px;background:#f0ede8;border-radius:2px;"></div>`}
          </td>
          <td style="padding-left:12px;vertical-align:middle;">
            <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#111111;">${item.name}</p>
            <p style="margin:0;font-size:11px;color:#888888;">
              ${item.size && item.size !== '—' ? `Size: ${item.size} · ` : ''}R${Number(item.price).toFixed(2)} each
            </p>
          </td>
        </tr></table>
      </td>
    </tr>`).join('');

  const moreItems = (order.items || []).length > 2
    ? `<p style="margin:8px 0 0;font-size:12px;color:#888;">+${order.items.length - 2} more item${order.items.length - 2 !== 1 ? 's' : ''}</p>`
    : '';

  await send({
    to:      userEmail,
    subject: `${firstName}, you left something behind 👀`,
    html: layout(`
      <tr>
        <td style="background:#111111;padding:48px 40px;text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">🛒</div>
          <h1 style="margin:0;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Still thinking<br/>about it?</h1>
          <p style="margin:12px 0 0;font-size:14px;color:#888888;line-height:1.6;">
            You left ${(order.items || []).length} item${(order.items || []).length !== 1 ? 's' : ''} in your cart.
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:48px 40px;">
          <p style="margin:0 0 28px;font-size:15px;color:#444444;line-height:1.8;">
            Hey <strong>${firstName}</strong>, looks like you didn't finish your order. Your items are still waiting for you.
          </p>

          <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#111111;border-bottom:2px solid #111;padding-bottom:12px;">Your Cart</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">${itemsPreview}</table>
          ${moreItems}

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
            <tr>
              <td style="font-size:14px;color:#888;padding:8px 0;border-top:1px solid #f0f0f0;">Cart Total</td>
              <td align="right" style="font-size:16px;font-weight:900;color:#111;padding:8px 0;border-top:1px solid #f0f0f0;font-family:monospace;">R${total.toFixed(2)}</td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
            <tr>
              <td align="center">
                <a href="${STORE_URL}/checkout.html" style="display:inline-block;background:#c84b2f;color:#ffffff;padding:16px 48px;text-decoration:none;font-size:13px;font-weight:900;letter-spacing:2px;text-transform:uppercase;">
                  COMPLETE MY ORDER
                </a>
              </td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border-left:4px solid #c84b2f;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c84b2f;">Why shop with us?</p>
              <p style="margin:0;font-size:12px;color:#888;line-height:1.7;">🚚 Flat rate shipping R${SHIPPING_FEE} nationwide &nbsp;·&nbsp; 🔒 Secure PayFast checkout &nbsp;·&nbsp; 7-day returns</p>
            </td></tr>
          </table>

          <p style="margin:28px 0 0;font-size:12px;color:#aaa;text-align:center;">
            Questions? <a href="mailto:customersupport@vintage808info.com" style="color:#c84b2f;">customersupport@vintage808info.com</a>
          </p>
        </td>
      </tr>
    `),
  });
}

/* ═══════════════════════════════════════════════════════════
   11. PASSWORD CHANGED — security alert
   Fire after any successful password change
═══════════════════════════════════════════════════════════ */
export async function sendPasswordChanged(user) {
  const firstName = user.name?.split(' ')[0] || 'there';
  const time      = new Date().toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });

  await send({
    to:      user.email,
    subject: 'Your Vintage808 password was changed',
    html: layout(`
      <tr>
        <td style="background:#111111;padding:48px 40px;text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">🔐</div>
          <h1 style="margin:0;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Password Changed</h1>
        </td>
      </tr>
      <tr>
        <td style="background:#c84b2f;padding:14px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffffff;">
            ✓ &nbsp; Your account password has been updated
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:48px 40px;">
          <p style="margin:0 0 24px;font-size:15px;color:#444444;line-height:1.8;">
            Hey <strong>${firstName}</strong>, your Vintage808 account password was successfully changed on <strong>${time}</strong>.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;background:#fef9c3;border:1px solid #fde68a;border-left:4px solid #d97706;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#854d0e;">⚠️ Wasn't you?</p>
              <p style="margin:0;font-size:13px;color:#444;line-height:1.7;">
                If you didn't make this change, your account may be compromised. Please contact us immediately at
                <a href="mailto:customersupport@vintage808info.com" style="color:#854d0e;">customersupport@vintage808info.com</a>.
              </p>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr style="background:#f9f9f9;">
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Account</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;">${user.email}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Changed At</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;">${time}</td>
            </tr>
          </table>

          <p style="margin:32px 0 0;font-size:13px;color:#888;line-height:1.8;">
            If this was you, no action is needed. <a href="${STORE_URL}/account.html" style="color:#c84b2f;">View your account →</a>
          </p>
        </td>
      </tr>
    `),
  });
}

/* ═══════════════════════════════════════════════════════════
   12. ADMIN NEW ORDER NOTIFICATION
═══════════════════════════════════════════════════════════ */
export async function sendAdminOrderNotification(order) {
  const orderId  = order.orderNumber || ('#' + (order._id || order.id).toString().slice(-6).toUpperCase());
  const shipping = Number(order.shippingFee ?? SHIPPING_FEE);
  const total    = Number(order.total);

  await send({
    to:      ADMIN_EMAIL,
    subject: `🛒 New order ${orderId} — R${total.toFixed(2)}`,
    html: layout(`
      <tr>
        <td style="background:#111111;padding:32px 40px;border-bottom:3px solid #c84b2f;">
          <p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#888888;">Admin Alert</p>
          <h1 style="margin:0;font-size:28px;font-weight:900;color:#ffffff;">New Order Received</h1>
          <p style="margin:8px 0 0;font-size:13px;color:#888888;letter-spacing:1px;">${orderId}</p>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:40px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr style="background:#f9f9f9;">
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Customer</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;font-weight:700;">${order.customerName || '—'}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Email</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;">${order.customerEmail || '—'}</td>
            </tr>
            <tr style="background:#f9f9f9;">
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Items</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;">${(order.items || []).length} item(s)</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:12px;color:#888;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Shipping</td>
              <td align="right" style="padding:12px 16px;font-size:13px;color:#111;font-family:monospace;">R${shipping.toFixed(2)}</td>
            </tr>
            <tr style="background:#c84b2f;">
              <td style="padding:14px 16px;font-size:12px;color:#fff;font-weight:900;letter-spacing:1px;text-transform:uppercase;">Total</td>
              <td align="right" style="padding:14px 16px;font-size:16px;color:#fff;font-weight:900;font-family:monospace;">R${total.toFixed(2)}</td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;"><tr>
            <td>
              <a href="https://vintage808-admin.vercel.app" style="display:inline-block;background:#c84b2f;color:#ffffff;padding:14px 40px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">VIEW IN ADMIN</a>
            </td>
          </tr></table>
        </td>
      </tr>
    `),
  });
}

/* ═══════════════════════════════════════════════════════════
   13. LOW STOCK / OVERSELL ADMIN ALERT
═══════════════════════════════════════════════════════════ */
export async function sendLowStockAlert({ type, product, orderId, items }) {
  if (!ADMIN_EMAIL) return;

  if (type === 'low' && product) {
    await send({
      to:      ADMIN_EMAIL,
      subject: `⚠️ Low stock: ${product.name} — ${product.stock} left`,
      html: layout(`
        <tr><td style="background:#ffffff;padding:40px;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#854d0e;">⚠️ Low Stock Alert</p>
          <h2 style="margin:0 0 24px;font-size:24px;font-weight:900;color:#111;">${product.name}</h2>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fef9c3;border:1px solid #fde68a;border-left:4px solid #d97706;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 6px;font-size:13px;color:#92400e;">Only <strong>${product.stock} unit${product.stock !== 1 ? 's' : ''}</strong> remaining.</p>
              <p style="margin:0;font-size:12px;color:#92400e;">Restock soon to avoid selling out.</p>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;"><tr><td>
            <a href="https://vintage808-admin.vercel.app" style="display:inline-block;background:#111111;color:#ffffff;padding:14px 32px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">UPDATE STOCK IN ADMIN</a>
          </td></tr></table>
        </td></tr>
      `),
    });
  }

  if (type === 'oversell' && items) {
    const rows = items.map(i => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#111;">${i.name}${i.size ? ` (${i.size})` : ''}</td>
        <td align="right" style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#991b1b;font-weight:700;">Only ${i.available} available</td>
      </tr>`).join('');

    await send({
      to:      ADMIN_EMAIL,
      subject: `🚨 Oversell — Order #${orderId?.slice(-6).toUpperCase()} — action needed`,
      html: layout(`
        <tr><td style="background:#ffffff;padding:40px;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#991b1b;">🚨 Oversell Alert</p>
          <h2 style="margin:0 0 8px;font-size:24px;font-weight:900;color:#111;">Manual action needed</h2>
          <p style="margin:0 0 24px;font-size:14px;color:#555;">Payment received for order <strong>#${orderId?.slice(-6).toUpperCase()}</strong> but stock was insufficient.</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fee2e2;border:1px solid #fecaca;border-left:4px solid #dc2626;">
            <tr>
              <td style="padding:10px 16px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#991b1b;border-bottom:1px solid #fecaca;">Item</td>
              <td align="right" style="padding:10px 16px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#991b1b;border-bottom:1px solid #fecaca;">Stock</td>
            </tr>
            ${rows}
          </table>
          <p style="margin:24px 0;font-size:13px;color:#555;line-height:1.8;">Contact the customer to arrange a refund or alternative.</p>
          <a href="https://vintage808-admin.vercel.app" style="display:inline-block;background:#dc2626;color:#ffffff;padding:14px 32px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">VIEW ORDER IN ADMIN</a>
        </td></tr>
      `),
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   14. CONTACT FORM
═══════════════════════════════════════════════════════════ */
export async function sendContactEmail({ name, email, message }) {
  await send({
    to:      ADMIN_EMAIL,
    replyTo: email,
    subject: `📩 New Contact Message — ${name}`,
    html: layout(`
      <tr><td style="background:#ffffff;padding:40px;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#888;">Contact Form Submission</p>
        <h2 style="margin:0 0 24px;font-size:24px;font-weight:900;color:#111;">New Message Received</h2>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#111;"><strong>Name:</strong> ${name}</td></tr>
          <tr><td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#111;"><strong>Email:</strong> ${email}</td></tr>
          <tr><td style="padding:20px 0;font-size:13px;color:#111;">
            <strong>Message:</strong><br/><br/>
            <div style="background:#f9f9f9;padding:16px;border-left:4px solid #c84b2f;white-space:pre-wrap;font-size:13px;color:#444;">${message}</div>
          </td></tr>
        </table>
        <p style="margin-top:24px;font-size:12px;color:#777;">Reply directly to this email to respond to the customer.</p>
      </td></tr>
    `),
  });
}

/* ═══════════════════════════════════════════════════════════
   15. OTP / PASSWORD RESET
═══════════════════════════════════════════════════════════ */
export async function sendOtpEmail(user, otp) {
  const firstName = user.name?.split(' ')[0] || 'there';
  await send({
    to:      user.email,
    subject: `Your Vintage808 reset code: ${otp}`,
    html: layout(`
      <tr>
        <td style="background:#111111;padding:48px 40px;text-align:center;">
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#888888;">Password Reset</p>
          <h1 style="margin:0;font-size:32px;font-weight:900;color:#ffffff;">Your reset code</h1>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:48px 40px;text-align:center;">
          <p style="margin:0 0 32px;font-size:15px;color:#444444;line-height:1.8;">
            Hey <strong>${firstName}</strong>, use the code below. It expires in <strong>10 minutes</strong>.
          </p>
          <div style="display:inline-block;background:#f4f4f4;border:2px solid #111;padding:24px 48px;margin-bottom:32px;">
            <span style="font-size:42px;font-weight:900;letter-spacing:12px;color:#111111;font-family:monospace;">${otp}</span>
          </div>
          <p style="margin:0;font-size:12px;color:#888888;">If you didn't request this, ignore this email.</p>
        </td>
      </tr>
    `),
  });
}

/* ═══════════════════════════════════════════════════════════
   16. SUBSCRIBER WELCOME
═══════════════════════════════════════════════════════════ */
export async function sendSubscriberWelcome(email) {
  await send({
    to:      email,
    subject: 'You\'re on the list — Vintage808',
    html: layout(`
      <tr>
        <td style="background:#c84b2f;padding:48px 40px;text-align:center;">
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.7);">You're in.</p>
          <h1 style="margin:0;font-size:36px;font-weight:900;color:#ffffff;letter-spacing:-1px;line-height:1.1;">First to know.<br/>First to shop.</h1>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:48px 40px;text-align:center;">
          <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.8;max-width:420px;margin-left:auto;margin-right:auto;">
            You're now subscribed to Vintage808 drop alerts. We'll only email you when something new lands — no spam, ever.
          </p>
          <a href="${STORE_URL}/shop.html" style="display:inline-block;background:#111111;color:#ffffff;padding:16px 48px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:32px;">SHOP NOW</a>
          <p style="margin:0;font-size:11px;color:#aaa;">
            Changed your mind? <a href="${STORE_URL}/api/subscribe/unsubscribe?email=${encodeURIComponent(email)}" style="color:#888;">Unsubscribe</a>
          </p>
        </td>
      </tr>
    `),
  });
}

/* ═══════════════════════════════════════════════════════════
   17. NEW PRODUCT DROP — blast to all subscribers
   Call this from your admin when you publish a new product
═══════════════════════════════════════════════════════════ */
export async function sendNewProductDrop(product, subscribers = []) {
  const productUrl = `${STORE_URL}/shop.html`;
  const imageHtml  = product.image
    ? `<img src="${product.image}" width="300" style="display:block;margin:0 auto 32px;max-width:100%;object-fit:cover;" />`
    : '';

  for (const email of subscribers) {
    await send({
      to:      email,
      subject: `New drop: ${product.name} 🔥`,
      html: layout(`
        <tr>
          <td style="background:#111111;padding:48px 40px;text-align:center;">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#888888;">New Drop</p>
            <h1 style="margin:0;font-size:36px;font-weight:900;color:#ffffff;letter-spacing:-1px;line-height:1.1;">${product.name}</h1>
            <p style="margin:12px 0 0;font-size:20px;font-weight:700;color:#c84b2f;font-family:monospace;">R${Number(product.price).toFixed(2)}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:48px 40px;text-align:center;">
            ${imageHtml}
            ${product.description ? `<p style="margin:0 0 32px;font-size:15px;color:#444;line-height:1.8;max-width:420px;margin-left:auto;margin-right:auto;">${product.description}</p>` : ''}
            <a href="${productUrl}" style="display:inline-block;background:#111111;color:#ffffff;padding:16px 48px;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:32px;">SHOP THE DROP</a>
            <p style="margin:0;font-size:11px;color:#aaa;">
              <a href="${STORE_URL}/api/subscribe/unsubscribe?email=SUBSCRIBER_EMAIL" style="color:#888;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      `),
    });
  }
}