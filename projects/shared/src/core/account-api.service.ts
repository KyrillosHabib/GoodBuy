import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import {
  Address,
  AddressInput,
  CustomerProfile,
  LoginResponse,
  OtpInfo,
  RegisterRequest,
  UpdateProfileRequest,
} from './models';

// Customer accounts of the online store: sign-up, e-mail code, password reset, profile and addresses
@Injectable({ providedIn: 'root' })
export class AccountApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = `${environment.apiUrl}/api/auth`;
  private readonly account = `${environment.apiUrl}/api/account`;

  register(body: RegisterRequest): Observable<OtpInfo> {
    return this.http.post<OtpInfo>(`${this.auth}/register`, body);
  }

  // Confirms the e-mail; the answer is a sign-in
  verifyEmail(email: string, code: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.auth}/verify-email`, { email, code });
  }

  resendOtp(email: string, purpose: 'verify' | 'reset'): Observable<OtpInfo> {
    return this.http.post<OtpInfo>(`${this.auth}/resend-otp`, { email, purpose });
  }

  forgotPassword(email: string): Observable<OtpInfo> {
    return this.http.post<OtpInfo>(`${this.auth}/forgot-password`, { email });
  }

  resetPassword(email: string, code: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.auth}/reset-password`, { email, code, newPassword });
  }

  // ---------- signed-in customer ----------

  getMe(): Observable<CustomerProfile> {
    return this.http.get<CustomerProfile>(`${this.account}/me`);
  }

  updateMe(body: UpdateProfileRequest): Observable<CustomerProfile> {
    return this.http.put<CustomerProfile>(`${this.account}/me`, body);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.account}/change-password`, { currentPassword, newPassword });
  }

  getAddresses(): Observable<Address[]> {
    return this.http.get<Address[]>(`${this.account}/addresses`);
  }

  createAddress(body: AddressInput): Observable<Address> {
    return this.http.post<Address>(`${this.account}/addresses`, body);
  }

  updateAddress(id: number, body: AddressInput): Observable<Address> {
    return this.http.put<Address>(`${this.account}/addresses/${id}`, body);
  }

  setDefaultAddress(id: number): Observable<void> {
    return this.http.put<void>(`${this.account}/addresses/${id}/default`, {});
  }

  deleteAddress(id: number): Observable<void> {
    return this.http.delete<void>(`${this.account}/addresses/${id}`);
  }
}
