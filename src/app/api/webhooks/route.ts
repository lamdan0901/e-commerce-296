import { db } from "@/db";
import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { OrderReceivedEmail } from "@/components";

// const resend = new Resend(process.env.RESEND_API_KEY);

// This endpoint is used to handle the webhook events from Stripe - when payment is completed.
export async function POST(req: Request) {
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

    const updatedOrder = await db.order.update({
      where: {
        id: orderId,
      },
      data: {
        isPaid: true,
        ShippingAddress: {
          create: {
            name: session.customer_details!.name!,
            city: shippingAddress!.city!,
            country: shippingAddress!.country!,
            postalCode: shippingAddress!.postal_code!,
            street: shippingAddress!.line1!,
            state: shippingAddress!.state,
          },
        },
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

    // await resend.emails.send({
    //   from: "CaseCobra <hello@phonecase-vip.com>",
    //   to: [event.data.object.customer_details.email],
    //   subject: "Thanks for your order!",
    //   react: OrderReceivedEmail({
    //     orderId,
    //     orderDate: updatedOrder.createdAt.toLocaleDateString(),
    //     shippingAddress: {
    //       name: session.customer_details!.name!,
    //       city: shippingAddress!.city!,
    //       country: shippingAddress!.country!,
    //       postalCode: shippingAddress!.postal_code!,
    //       street: shippingAddress!.line1!,
    //       state: shippingAddress!.state,
    //     },
    //   }),
    // });

    return NextResponse.json({ result: event, ok: true });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { message: "Something went wrong", ok: false },
      { status: 500 }
    );
  }
}
