import { Order, User, ShippingAddress, Prisma } from "@prisma/client";

export type OrderCount = Prisma.GetOrderAggregateType<{
  where: {
    isPaid: true;
    createdAt: {
      gte: Date;
    };
  };
  _sum: {
    amount: true;
  };
}>;

export type OrderWithShippingAdd = Order & {
  user: User;
  ShippingAddress: ShippingAddress | null;
};
