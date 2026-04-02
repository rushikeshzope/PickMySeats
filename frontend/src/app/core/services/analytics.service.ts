import { Injectable, inject, NgZone } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SalesData {
    event_id: string;
    event_title: string;
    tickets_sold: number;
    max_tickets: number;
    revenue: string;
    recent_sales: RecentSale[];
}

export interface RecentSale {
    ticket_id: string;
    buyer_name: string;
    purchased_at: string;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
    private zone = inject(NgZone);

    /**
     * Connect to the SSE sales stream for a specific event.
     * Returns an Observable that emits SalesData on each update.
     */
    salesStream(eventId: string): Observable<SalesData> {
        return new Observable(observer => {
            const eventSource = new EventSource(
                `${environment.apiUrl}/analytics/sales/${eventId}`
            );

            eventSource.onmessage = (event) => {
                this.zone.run(() => {
                    try {
                        const data: SalesData = JSON.parse(event.data);
                        observer.next(data);
                    } catch (err) {
                        console.error('SSE parse error:', err);
                    }
                });
            };

            eventSource.onerror = () => {
                this.zone.run(() => {
                    eventSource.close();
                    observer.complete();
                });
            };

            // Cleanup on unsubscribe
            return () => eventSource.close();
        });
    }
}
