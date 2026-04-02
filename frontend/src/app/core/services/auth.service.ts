import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
    id: string;
    email: string;
    full_name: string;
    role: string;  // 'attendee' | 'organizer' | 'admin'
}

export interface AuthResponse {
    token: string;
    user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private currentUserSubject = new BehaviorSubject<User | null>(null);
    private tokenKey = 'scantix_token';
    private userKey = 'scantix_user';

    currentUser$ = this.currentUserSubject.asObservable();

    constructor(
        private http: HttpClient,
        private router: Router
    ) {
        this.loadStoredUser();
    }

    private loadStoredUser(): void {
        const storedUser = localStorage.getItem(this.userKey);
        if (storedUser) {
            this.currentUserSubject.next(JSON.parse(storedUser));
        }
    }

    get currentUser(): User | null {
        return this.currentUserSubject.value;
    }

    get token(): string | null {
        return localStorage.getItem(this.tokenKey);
    }

    get isAuthenticated(): boolean {
        return !!this.token;
    }

    get role(): string {
        return this.currentUser?.role ?? '';
    }

    get isOrganizer(): boolean {
        return this.role === 'organizer' || this.role === 'admin';
    }

    get isAdmin(): boolean {
        return this.role === 'admin';
    }

    register(email: string, password: string, fullName: string, role: string = 'attendee'): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, {
            email,
            password,
            full_name: fullName,
            role
        }).pipe(tap(res => this.storeAuth(res)));
    }

    login(email: string, password: string): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, {
            email,
            password
        }).pipe(tap(res => this.storeAuth(res)));
    }

    logout(): void {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        this.currentUserSubject.next(null);
        this.router.navigate(['/events']);
    }

    private storeAuth(res: AuthResponse): void {
        localStorage.setItem(this.tokenKey, res.token);
        localStorage.setItem(this.userKey, JSON.stringify(res.user));
        this.currentUserSubject.next(res.user);
    }
}
