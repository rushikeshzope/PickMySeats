import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface EventSeat {
    id: string;
    event_id: string;
    row_label: string;
    seat_number: number;
    status: 'available' | 'locked' | 'booked';
    locked_by: string | null;
    locked_until: string | null;
    created_at: string;
}

export interface LockSeatResponse {
    seat: EventSeat;
    locked_until: string;
}

@Injectable({ providedIn: 'root' })
export class SeatService {
    constructor(private http: HttpClient) { }

    getEventSeats(eventId: string): Observable<EventSeat[]> {
        return this.http.get<EventSeat[]>(`${environment.apiUrl}/events/${eventId}/seats`);
    }

    generateSeats(eventId: string): Observable<EventSeat[]> {
        return this.http.post<EventSeat[]>(`${environment.apiUrl}/events/${eventId}/seats/generate`, {});
    }

    lockSeat(eventId: string, seatId: string): Observable<LockSeatResponse> {
        return this.http.post<LockSeatResponse>(
            `${environment.apiUrl}/events/${eventId}/seats/${seatId}/lock`, {}
        );
    }

    unlockSeat(eventId: string, seatId: string): Observable<void> {
        return this.http.delete<void>(
            `${environment.apiUrl}/events/${eventId}/seats/${seatId}/lock`
        );
    }

    lockSeats(eventId: string, seatIds: string[]): Observable<{ seats: EventSeat[], locked_until: string }> {
        return this.http.post<{ seats: EventSeat[], locked_until: string }>(
            `${environment.apiUrl}/events/${eventId}/seats/lock-batch`,
            { seat_ids: seatIds }
        );
    }

    unlockSeats(eventId: string, seatIds: string[]): Observable<{ unlocked: number }> {
        return this.http.post<{ unlocked: number }>(
            `${environment.apiUrl}/events/${eventId}/seats/unlock-batch`,
            { seat_ids: seatIds }
        );
    }
}
