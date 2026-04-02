import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Ticket } from './ticket.service';

export interface RazorpayOrder {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  event_id: string;
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  event_id: string;
  seat_ids?: string[];
  quantity?: number;
  ticket_type?: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  constructor(private http: HttpClient) {}

  createOrder(amountPaise: number, eventId: string, seatIds?: string[], quantity?: number): Observable<RazorpayOrder> {
    return this.http.post<RazorpayOrder>(`${environment.apiUrl}/payment/create-order`, {
      amount_paise: amountPaise,
      event_id: eventId,
      seat_ids: seatIds,
      quantity
    });
  }

  verifyAndBook(data: VerifyPaymentRequest): Observable<Ticket[]> {
    return this.http.post<Ticket[]>(`${environment.apiUrl}/payment/verify`, data);
  }
}
