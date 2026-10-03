import React from 'react'
import { DeliveryRadar, type DeliveryRadarProps } from '@/components/order/delivery-radar'

export type OrderStatusTimelineProps = DeliveryRadarProps

export const OrderStatusTimeline: React.FC<OrderStatusTimelineProps> = (props) => {
  return <DeliveryRadar {...props} />
}
