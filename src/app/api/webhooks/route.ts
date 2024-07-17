import { db } from "@/db";
import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ShippingAddress } from "@prisma/client";
const brevo = require("@getbrevo/brevo");

// This endpoint is used to handle the webhook events from Stripe - when payment is completed.
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = headers().get("stripe-signature");

    if (!signature) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_SIGNING_SECRET!
    );

    if (event.type !== "checkout.session.completed") {
      return NextResponse.json(
        { message: "Event type is wrong", ok: false },
        { status: 500 }
      );
    }

    if (!event.data.object.customer_details?.email) {
      throw new Error("Missing user email");
    }

    const session = event.data.object;

    // Extract the order metadata from the session sent with the payment.
    const { userId, orderId } = session.metadata || {
      userId: null,
      orderId: null,
    };

    if (!userId || !orderId) {
      throw new Error("Invalid request metadata");
    }

    const billingAddress = session.customer_details!.address;
    const shippingAddress = session.shipping_details!.address;
    const _shippingAddress = {
      name: session.customer_details!.name!,
      city: shippingAddress!.city!,
      country: shippingAddress!.country!,
      postalCode: shippingAddress!.postal_code!,
      street: shippingAddress!.line1!,
      state: shippingAddress!.state,
    };

    const updatedOrder = await db.order.update({
      where: {
        id: orderId,
      },
      data: {
        isPaid: true,
        ShippingAddress: { create: _shippingAddress },
        BillingAddress: {
          create: {
            name: session.customer_details!.name!,
            city: billingAddress!.city!,
            country: billingAddress!.country!,
            postalCode: billingAddress!.postal_code!,
            street: billingAddress!.line1!,
            state: billingAddress!.state,
          },
        },
      },
    });

    await sendOrderEmail(
      session.customer_details?.email ?? "",
      _shippingAddress,
      orderId,
      updatedOrder.createdAt.toLocaleDateString()
    );

    return NextResponse.json({ result: event, success: true });
  } catch (err) {
    console.error("webhook events from Stripe error", err);

    return NextResponse.json(
      { message: "Something went wrong", success: false },
      { status: 500 }
    );
  }
}

async function sendOrderEmail(
  email: string,
  shippingAddress: Partial<ShippingAddress>,
  orderId: string,
  orderDate: string
) {
  console.log("email: ", email);
  if (!email) throw new Error("Missing user email");

  const apiInstance = new brevo.TransactionalEmailsApi();
  const apiKey = apiInstance.authentications["apiKey"];
  apiKey.apiKey = process.env.BREVO_API_KEY;

  const sendSmtpEmail = new brevo.SendSmtpEmail();

  sendSmtpEmail.headers = {
    "Message-Id": "<123.123@smtp-relay.mailin.fr>",
  };
  sendSmtpEmail.subject = "Your order summary and estimated delivery date";
  sendSmtpEmail.params = {
    orderDate,
    orderId,
    shippingAddressName: shippingAddress.name,
    shippingAddressStreet: shippingAddress.street,
    shippingAddressCity: shippingAddress.city,
    shippingAddressState: shippingAddress.state,
    shippingAddressPostalCode: shippingAddress.postalCode,
  };
  sendSmtpEmail.sender = {
    name: "Ahihos",
    email: "thichluudan@gmail.com",
  };
  sendSmtpEmail.to = [{ email, name: shippingAddress.name }];
  sendSmtpEmail.replyTo = {
    name: "Ahihos",
    email: "thichluudan@gmail.com",
  };
  sendSmtpEmail.htmlContent = `<!DOCTYPE html>
  <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Welcome</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap"
          rel="stylesheet"
        />
    </head>
    <body style="background: #fff; margin: 0; padding: 0; font-family: 'Inter', sans-serif;">
      <div class="wrapper" style="background-color: white; border-radius: 8px; padding: 20px;">
        <div class="container" style="width: 100%; max-width: 450px; margin: auto; padding: 40px 12px;">
          <header>
            <h1
              style="margin: 28px 0 48px 0; font-size: 42px; font-weight: 600; color: black; line-height: 50px;"
            >
              Thank you for your order!
            </h1>
            <p
              class="intro"
              style="padding-bottom: 20px; font-size: 16px; color: black; line-height: 22px;"
            >
              We&apos;re preparing everything for delivery and will notify you
              once your package has been shipped. Delivery usually takes 2 days.<br./>
              If you have any questions regarding your order, please feel free
              to contact us with your order number and we&apos;re here to help.
            </p>
          </header>
  
          <div
            class="divider"
            style="width: 100%; height: 2px; background-color: #444; margin: 24px 0;"
          ></div>

          <div>
            <p>Shipping to: {params.shippingAddressName}</p>
            <p>
              {params.shippingAddressStreet}, {params.shippingAddressCity},{" "}
              {params.shippingAddressState} {params.shippingAddressPostalCode}
            </p>
          </div>

          <div>
            <p>Order Number</p>
            <p>{params.orderId}</p>
          </div>
          <div>
            <p>Order Date</p>
            <p>{params.orderDate}</p>
          </div>
  
          <div
            class="divider"
            style="width: 100%; height: 2px; background-color: #444; margin: 24px 0;"
          ></div>
  
          <footer>
            <p style="font-size: 14px; color: black;">
              Please contact us if you have any questions. (If you reply to
              this email, we won&apos;t be able to see it.)
            </p>
            <p class="footer-text" style="font-size: 14px; color: black;">&copy;2024 All rights reserved.</p>
          </footer>
        </div>
      </div>
    </body>
  </html>`;

  const res = await apiInstance.sendTransacEmail(sendSmtpEmail);
  console.log("res: ", res.body);
}
