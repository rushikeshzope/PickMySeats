import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { finalize, Subject, debounceTime, distinctUntilChanged, switchMap, tap, of } from 'rxjs';
import { EventService, UpdateEventPayload, ScanEvent } from '../../../core/services/event.service';
import { SeatService } from '../../../core/services/seat.service';
import { LocationService, LocationSuggestion } from '../../../core/services/location.service';
import { ImageCropperComponent, CroppedEvent } from '../../../shared/image-cropper/image-cropper.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-event-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ImageCropperComponent],
  template: `
    <div class="page-container animate-fadeIn">
      <div class="page-header" style="text-align: center; margin-bottom: 32px;">
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:8px">
          <h1>✏️ <span class="gradient-text">Update Event</span></h1>
          @if (ticketsSold > 0) {
            <span class="badge badge-warning">LOCKED FIELDS</span>
          }
        </div>
        <p>Update your event details. Some fields are locked once tickets are sold.</p>
      </div>

      <div class="glass-card form-card">
        @if (error) { <div class="alert alert-danger">{{ error }}</div> }
        @if (success) { <div class="alert alert-success">{{ success }}</div> }

        @if (initialLoading) {
          <div style="text-align:center;padding:40px">
            <div class="spinner"></div>
            <p>Loading event data...</p>
          </div>
        } @else {
          <form #eventForm="ngForm" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label>Event Title *</label>
              <input class="form-control" [(ngModel)]="title" name="title" placeholder="e.g. TechX Summit, Sufi Under the Stars" required>
            </div>

            <div class="form-group">
              <label>Description *</label>
              <textarea class="form-control" [(ngModel)]="description" name="description"
                        placeholder="Tell attendees what makes this event special — vibe, experience, highlights, and why they should come." rows="4" required></textarea>
            </div>

            <div class="form-group" style="position:relative">
              <label>📍 Location *</label>
              <input class="form-control" [(ngModel)]="location" name="location"
                     [disabled]="ticketsSold > 0"
                     placeholder="e.g. Phoenix Marketcity, Pune • JW Marriott, Mumbai • Open Air Arena, Delhi" required
                     (ngModelChange)="onLocationInput($event)" autocomplete="off">
              
              @if (isSearchingLocation) {
                <div class="location-spinner"></div>
              }

              @if (locationSuggestions.length > 0) {
                <div class="location-suggestions-dropdown glass-card">
                  @for (sugg of locationSuggestions; track sugg.displayName) {
                    <div class="suggestion-item" (click)="selectLocation(sugg)">
                      <div class="suggestion-name">{{ sugg.city || sugg.displayName }}</div>
                      <div class="suggestion-details">{{ sugg.displayName }}</div>
                    </div>
                  }
                </div>
              }
              @if (ticketsSold > 0) {
                <small class="form-hint" style="color:var(--warning)">Location cannot be changed after tickets are sold.</small>
              }
            </div>

            <div class="form-group">
              <label>📸 Event Photos (Existing & New) *</label>
              <div class="custom-file-input">
                <button type="button" class="btn-file-select" (click)="fileInput.click()">Choose Files</button>
                <span class="file-name-label">
                  {{ selectedFiles.length + existingImageUrls.length }} file(s) total
                </span>
                <input #fileInput type="file" style="display:none" multiple accept="image/*" (change)="onFilesSelected($event)">
              </div>
              <small class="form-hint" style="margin-bottom: 12px;">Photos are updated immediately. The first photo is your cover photo.</small>
              
              <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
                <!-- Existing Images -->
                @for (url of existingImageUrls; track url; let i = $index) {
                  <div style="position:relative;width:100px;height:100px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.1)">
                    <img [src]="getImageUrl(url)" style="width:100%;height:100%;object-fit:cover">
                    <button type="button" (click)="removeExistingFile(i)" 
                            style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);border:none;color:white;border-radius:50%;width:24px;height:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px">✕</button>
                    @if (i === 0) {
                      <span style="position:absolute;bottom:0;left:0;right:0;background:rgba(234,179,8,0.8);color:#000;font-weight:600;font-size:10px;text-align:center;padding:2px 0">COVER</span>
                    }
                  </div>
                }
                <!-- New Uploaded Images -->
                @for (file of selectedFiles; track file.name; let i = $index) {
                  <div style="position:relative;width:100px;height:100px;border-radius:8px;overflow:hidden;border:1px solid var(--accent-primary); box-shadow: 0 0 10px rgba(168, 85, 247, 0.25)">
                    <img [src]="filePreviewUrls[i]" style="width:100%;height:100%;object-fit:cover">
                    <button type="button" (click)="removeFile(i)" 
                            style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);border:none;color:white;border-radius:50%;width:24px;height:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px">✕</button>
                    <span style="position:absolute;bottom:0;left:0;right:0;background:var(--accent-primary);color:#000;font-weight:600;font-size:9px;text-align:center;padding:1px 0">NEW</span>
                  </div>
                }
              </div>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label>Event Date & Time *</label>
                <input type="datetime-local" class="form-control" [(ngModel)]="eventDate" name="event_date" 
                       [disabled]="ticketsSold > 0" required>
                @if (ticketsSold > 0) {
                  <small class="form-hint" style="color:var(--warning)">Date cannot be changed after tickets are sold.</small>
                }
              </div>
              <div class="form-group">
                <label>Max Tickets *</label>
                <input type="text" class="form-control" [(ngModel)]="maxTickets" name="max_tickets"
                       placeholder="500" [disabled]="seatMapEnabled" 
                       (input)="enforceNumeric($event)" required>
                @if (ticketsSold > 0) {
                  <small class="form-hint">Must be at least {{ ticketsSold }} (already sold).</small>
                }
              </div>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label>🚪 Gate Opens At *</label>
                <input type="datetime-local" class="form-control" [(ngModel)]="gateOpenTime" name="gate_open_time"
                       [disabled]="ticketsSold > 0" required>
                <small class="form-hint">When gates open for attendees</small>
              </div>
              <div class="form-group">
                <label>🏁 Event Ends At *</label>
                <input type="datetime-local" class="form-control" [(ngModel)]="eventEndTime" name="event_end_time"
                       [disabled]="ticketsSold > 0" required>
                <small class="form-hint">When the event officially ends</small>
              </div>
            </div>

            <div class="form-group">
              <label>🗺️ Google Maps Venue Link *</label>
              <input type="url" class="form-control" [(ngModel)]="googleMapsUrl" name="google_maps_url"
                     placeholder="https://maps.google.com/?q=..." required>
              <small class="form-hint">Paste the Google Maps link of the venue</small>
              @if (googleMapsUrl && !isValidMapsUrl(googleMapsUrl)) {
                <span style="color:var(--danger);font-size:0.78rem">Please enter a valid URL (must start with http)</span>
              }
            </div>

            <div class="seat-toggle-card" [style.borderColor]="isFreeEvent ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'" 
                 [style.background]="isFreeEvent ? 'rgba(16,185,129,0.03)' : 'transparent'" style="margin-bottom:20px">
              <div class="seat-toggle-header" (click)="ticketsSold === 0 ? (isFreeEvent = !isFreeEvent) : null" 
                   [style.background]="isFreeEvent ? 'rgba(16,185,129,0.05)' : 'transparent'" [style.cursor]="ticketsSold > 0 ? 'not-allowed' : 'pointer'">
                <div>
                  <div class="seat-toggle-title" [style.color]="isFreeEvent ? '#10b981' : 'inherit'">✨ This is a Free Event</div>
                  <div class="seat-toggle-sub">Attendees can book without any ticket price</div>
                </div>
                <label class="toggle-switch" (click)="$event.stopPropagation()">
                  <input type="checkbox" [(ngModel)]="isFreeEvent" name="is_free_event" [disabled]="ticketsSold > 0">
                  <span class="slider" [style.background]="isFreeEvent ? '#10b981' : ''"></span>
                </label>
              </div>
              @if (ticketsSold > 0) {
                <div style="padding: 4px 20px 12px;"><small class="form-hint" style="color:var(--warning); margin: 0;">Pricing type cannot be changed after tickets are sold.</small></div>
              }
            </div>

            @if (!isFreeEvent) {
              <div [class.form-grid]="seatMapEnabled">
                <div class="form-group">
                  <label>Ticket Price (₹) *</label>
                  <input type="text" class="form-control" [(ngModel)]="ticketPrice"
                         [disabled]="ticketsSold > 0" name="ticket_price" placeholder="25.00"
                         (input)="enforceDecimal($event)" required>
                </div>
                @if (seatMapEnabled) {
                  <div class="form-group">
                    <label>VIP Price (₹) *</label>
                    <input type="text" class="form-control" [(ngModel)]="vipPrice"
                           [disabled]="ticketsSold > 0" name="vip_price" placeholder="75.00"
                           (input)="enforceDecimal($event)" required>
                  </div>
                }
              </div>
            }

            @if (!isFreeEvent) {
              <div class="form-group">
                <label>Refund Policy *</label>
                <div class="custom-select-wrapper">
                  <select class="form-control custom-select" [(ngModel)]="refundPolicy" name="refund_policy" required>
                    <option value="NON_REFUNDABLE">🔒 Non-Refundable</option>
                    <option value="REFUNDABLE">💸 Refundable (– 24h)</option>
                  </select>
                </div>
                <small class="form-hint" style="margin-top:8px; display:block;">
                  Refunds are only eligible when ticket cancellation happens at least 24 hours before event start.
                </small>
              </div>
            }

            <!-- ── Seat Layout Toggle ────────────────────────────────────── -->
            <div class="seat-toggle-card">
              <div class="seat-toggle-header" (click)="ticketsSold === 0 ? toggleSeatMap() : null" [style.cursor]="ticketsSold > 0 ? 'not-allowed' : 'pointer'">
                <div>
                  <div class="seat-toggle-title">🪑 Enable Seat Layout</div>
                  <div class="seat-toggle-sub">
                    Let attendees pick specific seats from a visual map
                  </div>
                </div>
                <label class="toggle-switch" (click)="$event.stopPropagation()">
                  <input type="checkbox" [(ngModel)]="seatMapEnabled" name="seat_map_enabled"
                         [disabled]="ticketsSold > 0" (change)="onSeatMapToggle()">
                  <span class="slider"></span>
                </label>
              </div>

              @if (seatMapEnabled) {
                <div class="seat-config">
                  <div class="form-group" style="margin-bottom:16px">
                    <label>Layout Style</label>
                    <div style="display:flex;gap:16px;margin-top:8px">
                      <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                        <input type="radio" name="seat_layout" [(ngModel)]="seatLayout" value="grid" [disabled]="ticketsSold > 0"> Grid View
                      </label>
                      <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                        <input type="radio" name="seat_layout" [(ngModel)]="seatLayout" value="stadium" [disabled]="ticketsSold > 0"> Stadium View
                      </label>
                    </div>
                  </div>
                  <div class="form-grid">
                    <div class="form-group" style="margin-bottom:0">
                      <label>Rows *</label>
                      <input type="number" class="form-control"
                             [(ngModel)]="seatRows" name="seat_rows"
                             placeholder="10" min="1" max="500"
                             [disabled]="ticketsSold > 0"
                             (ngModelChange)="recalcTotal()">
                      <small class="form-hint">Max 500 rows (A–Z, AA, AB...)</small>
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                      <label>Seats per Row *</label>
                      <input type="number" class="form-control"
                             [(ngModel)]="seatColumns" name="seat_columns"
                             placeholder="20" min="1" max="100"
                             [disabled]="ticketsSold > 0"
                             (ngModelChange)="recalcTotal()">
                      <small class="form-hint">Max 100 per row</small>
                    </div>
                  </div>
                  @if (ticketsSold > 0) {
                    <small class="form-hint" style="color:var(--warning); display:block; margin-top:12px;">Seat configuration cannot be changed after tickets are sold.</small>
                  }

                  @if (seatRows && seatColumns) {
                    <div class="seat-preview">
                      <span>
                        Generates
                        <strong>{{ formatRowRange(seatRows) }}</strong> ×
                        <strong>1–{{ seatColumns }}</strong> =
                        <strong>{{ totalSeats }} seats</strong>
                      </span>
                    </div>

                    <!-- Mini visual preview -->
                    <div class="mini-map-wrapper">
                      @if (seatLayout === 'grid') {
                        <div class="mini-map">
                          <div class="mini-rows-container">
                            @for (r of previewRows; track r; let i = $index) {
                              <div class="mini-row">
                                <span class="mini-label">{{ r }}</span>
                                @for (c of previewCols; track c) {
                                  <span class="mini-seat"></span>
                                }
                                @if (seatColumns > 8) {
                                  <span class="mini-ellipsis">…</span>
                                }
                              </div>
                            }
                          </div>
                          @if (seatRows > 5) {
                            <div class="mini-more">+ {{ seatRows - 5 }} more row(s)</div>
                          }
                        </div>
                      } @else {
                        <div class="mini-stadium-container">
                          <div class="mini-pitch">PITCH</div>
                          @for (r of previewRows; track r; let rIdx = $index) {
                            @for (c of previewCols; track c; let cIdx = $index) {
                              <div class="stadium-mini-seat" [ngStyle]="getMiniStadiumSeatStyle(rIdx, cIdx, previewCols.length)"></div>
                            }
                          }
                        </div>
                        @if (seatRows > 5 || seatColumns > 8) {
                          <div class="mini-more">+ more seats hidden in preview</div>
                        }
                      }
                    </div>
                  }
                </div>
              }
            </div>
            
            @if (!loading && !eventForm.valid && eventForm.touched) {
              <div class="validation-alert" style="margin-top:24px; margin-bottom:-12px; font-weight:600; color: #f87171; background: rgba(248, 113, 113, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(248, 113, 113, 0.2);">
                <span style="font-size:1.2rem">⚠️</span>
                @if (eventForm.controls['title']?.invalid) { <span>Title is required.</span> }
                @else if (eventForm.controls['description']?.invalid) { <span>Description is required.</span> }
                @else if (eventForm.controls['location']?.invalid) { <span>Location is required.</span> }
                @else if (eventForm.controls['event_date']?.invalid) { <span>Event Start Date & Time is required.</span> }
                @else if (eventForm.controls['gate_open_time']?.invalid) { <span>Gate Open Time is required.</span> }
                @else if (eventForm.controls['event_end_time']?.invalid) { <span>Event End Time is required.</span> }
                @else if (eventForm.controls['google_maps_url']?.invalid) { <span>Valid Google Maps URL is required.</span> }
                @else if (eventForm.controls['max_tickets']?.invalid) { <span>Max Tickets is required.</span> }
                @else if (eventForm.controls['ticket_price']?.invalid) { <span>Ticket Price is required.</span> }
                @else if (eventForm.controls['refund_policy']?.invalid) { <span>Refund Policy is required.</span> }
                @else { <span>Please fill all required fields correctly.</span> }
              </div>
            }

            <div class="form-actions-row">
              <button type="submit" class="btn btn-primary btn-lg flex-btn btn-update-premium" 
                      [disabled]="loading || !eventForm.valid || (seatMapEnabled && (!seatRows || !seatColumns || seatRows > 500 || seatColumns > 100)) || (selectedFiles.length + existingImageUrls.length) === 0">
                @if (loading) {
                  <span class="spinner" style="width:18px;height:18px;border-width:2px;margin-right:8px;"></span> UPDATING...
                } @else { UPDATE EVENT }
              </button>
    
              <button type="button" class="btn btn-secondary btn-sm cancel-btn btn-secondary-outline" (click)="cancel()" [disabled]="loading">Back</button>
            </div>

            @if (seatMapEnabled && seatRows && seatRows > 500) {
              <div style="color:#ef4444;font-size:0.85rem;margin-top:8px;text-align:center">Maximum 500 rows allowed.</div>
            }
          </form>
        }
      </div>
    </div>

    <!-- Custom Canvas Image Cropper Modal (Root level for viewport centering) -->
    @if (imageFile) {
      <app-image-cropper
        [imageFile]="imageFile"
        [aspectRatio]="16/9"
        (imageCropped)="onImageCropped($event)"
        (cropCanceled)="cancelCrop()">
      </app-image-cropper>
    }
  `,
  styles: [`
    .form-card { padding: 40px; max-width: 760px; margin: 0 auto; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .form-grid > * { min-width: 0; } /* prevents grid children from overflowing their cell */
    .form-grid input[type="datetime-local"] { width: 100%; box-sizing: border-box; }
    .form-actions-row { 
      display: flex; gap: 16px; margin-top: 32px; align-items: center; justify-content: center;
    }
    .flex-btn { flex: 1; display: flex; justify-content: center; align-items: center; gap: 8px; }
    .cancel-btn { 
      flex: 0 0 auto; padding: 8px 24px; height: 48px; min-width: 100px;
      /* background: rgba(255, 255, 255, 0.05) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      color: var(--text-muted) !important; */
    }

    button:disabled {
      background: #374151 !important;
      color: #9ca3af !important;
      cursor: not-allowed !important;
      box-shadow: none !important;
      opacity: 0.8;
      border-color: #4b5563 !important;
    }
    .seat-toggle-card {
      border:1px solid rgba(234,179,8,.3); border-radius:12px;
      overflow:hidden; margin-top:8px;
    }
    .seat-toggle-header {
      padding:16px 20px; display:flex; justify-content:space-between; align-items:center;
      background:rgba(234,179,8,.05); transition:background .2s;
      user-select:none;
    }
    .seat-toggle-header:hover { background:rgba(234,179,8,.1); }
    .seat-toggle-title { font-weight:600; font-size:1.1rem; color:var(--text-primary); margin-bottom:4px; }
    .seat-toggle-sub { font-size:.85rem; color:var(--text-muted); }

    .toggle-switch { position:relative; display:inline-block; width:44px; height:24px; }
    .toggle-switch input { opacity:0; width:0; height:0; }
    .slider {
      position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0;
      background-color:rgba(255,255,255,.1); transition:.4s; border-radius:24px;
    }
    .slider::before {
      position:absolute; content:""; height:18px; width:18px; left:3px; bottom:3px;
      background-color:white; transition:.4s; border-radius:50%;
    }
    input:checked + .slider { background:var(--accent-primary,#eab308); }
    input:checked + .slider::before { transform:translateX(20px); }

    .seat-config { padding:20px; border-top:1px solid rgba(234,179,8,.2); }
    .form-hint { font-size:.75rem; color:var(--text-muted); margin-top:4px; display:block; }

    .seat-preview {
      display:flex; align-items:center; justify-content:center; padding:12px 16px;
      background:rgba(34,197,94,.08); border:1px solid rgba(34,197,94,.25);
      border-radius:8px; margin-top:16px; font-size:.9rem; color:var(--text-secondary); text-align:center;
    }

    .mini-map { margin-top:14px; display:flex; flex-direction:column; gap:4px; align-items:center; }
    .mini-rows-container { display:flex; flex-direction:column; gap:4px; width:100%; align-items:center; }
    .mini-row { display: flex; gap: 4px; align-items: center; justify-content: center; width: 100%; }
    .mini-label { font-size: 0.65rem; color: var(--text-muted); width: 14px; text-align: right; }
    .mini-seat { width: 10px; height: 10px; background: rgba(56, 189, 248, 0.4); border-radius: 2px; }
    .mini-ellipsis { font-size: 0.7rem; color: var(--text-muted); letter-spacing: 1px; margin-left: 4px; }
    .mini-more { text-align: center; font-size: 0.7rem; color: var(--text-muted); margin-top: 8px; font-style: italic; }

    /* Circular Stadium-specific mini preview */
    .mini-stadium-container {
      position: relative;
      width: 140px;
      height: 140px;
      margin: 10px auto;
      border-radius: 50%;
      background: rgba(34,197,94,.1);
    }
    .mini-pitch {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 25px; height: 50px;
      background: rgba(202, 92, 24, 0.4);
      border: 1px solid rgba(202, 92, 24, 0.6);
      font-size: 0.4rem; color: #fef3c7;
      display: flex; align-items: center; justify-content: center;
      writing-mode: vertical-lr; text-orientation: upright;
      letter-spacing: 1px;
    }
    .stadium-mini-seat {
      position: absolute;
      width: 6px; height: 6px;
      background: rgba(56, 189, 248, 0.5);
      border-radius: 2px 2px 0 0;
      top: 50%; left: 50%;
      margin-left: -3px; margin-top: -3px;
    }
    
    .custom-file-input {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: var(--radius-md);
      transition: border-color 0.2s;
    }
    .custom-file-input:hover { border-color: rgba(234, 179, 8, 0.4); }
    .btn-file-select {
      background: #374151;
      color: white;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-file-select:hover { background: #4b5563; }
    .file-name-label { font-size: 0.9rem; color: var(--text-secondary); }

    .location-suggestions-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: 100;
      margin-top: 4px;
      padding: 8px 0;
      max-height: 240px;
      overflow-y: auto;
      background: #18181b;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    .custom-select-wrapper { 
      position: relative; 
      margin-top: 8px;
    }
    .custom-select-wrapper::after {
      content: "▼";
      font-size: 0.8rem;
      color: var(--text-muted);
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
    }
    .custom-select {
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      background-color: rgba(15, 23, 42, 0.4);
      border: 1px solid var(--border-glass);
      color: var(--text-primary);
      padding: 12px 40px 12px 14px;
      cursor: pointer;
      font-size: 0.95rem;
      transition: all 0.2s ease;
      height: 48px;
    }
    .custom-select:focus, .custom-select:hover {
      border-color: rgba(56, 189, 248, 0.5);
      background-color: rgba(15, 23, 42, 0.7);
    }
    .custom-select option {
      background: #1e293b;
      color: #f8fafc;
      padding: 12px;
    }
    .suggestion-item {
      padding: 10px 16px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .suggestion-item:hover {
      background: rgba(255,255,255,0.05);
    }
    .suggestion-name {
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--text-primary);
    }
    .suggestion-details {
      font-size: 0.75rem;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .location-spinner {
      position: absolute;
      right: 12px;
      top: 42px;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.1);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @media (max-width: 700px) {
      .form-card { padding: 20px 16px; }
      .form-grid { grid-template-columns: 1fr !important; }
      .form-actions-row { flex-direction: column; }
      .form-actions-row button { width: 100%; justify-content: center; }
    }

    .btn-update-premium {
      background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%);
      color: #000;
      border: none;
      font-weight: 700;
      padding: 14px 28px;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 15px rgba(168, 85, 247, 0.35);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .btn-update-premium:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(168, 85, 247, 0.5);
      filter: brightness(1.1);
    }
    .btn-update-premium:active:not(:disabled) {
      transform: translateY(0);
    }
    .btn-secondary-outline {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-primary);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 14px 28px;
      border-radius: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-secondary-outline:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; font-size: 0.95rem; }
    .alert-danger { background: rgba(239, 68, 68, 0.1); border: 1px solid var(--danger); color: #fca5a5; }
    .alert-success { background: rgba(34, 197, 94, 0.1); border: 1px solid var(--success); color: #86efac; }
  `]
})
export class EventEditComponent implements OnInit {
  eventId: string = '';
  ticketsSold: number = 0;

  title = '';
  description = '';
  location = '';
  eventDate = '';
  gateOpenTime = '';
  eventEndTime = '';
  googleMapsUrl = '';
  maxTickets: number | null = null;
  ticketPrice: number | null = null;
  vipPrice: number | null = null;
  refundPolicy: 'REFUNDABLE' | 'NON_REFUNDABLE' = 'NON_REFUNDABLE';
  isFreeEvent = false;

  initialLoading = true;
  loading = false;
  error = '';
  success = '';

  // Photos
  existingImageUrls: string[] = [];
  selectedFiles: File[] = [];
  filePreviewUrls: string[] = [];
  pendingFilesToCrop: File[] = [];
  imageFile: File | null = null;
  currentProcessingFileName: string = '';

  // Location suggestions
  private locationSearch$ = new Subject<string>();
  locationSuggestions: LocationSuggestion[] = [];
  isSearchingLocation = false;

  // Seat map
  seatMapEnabled = false;
  seatLayout: 'grid' | 'stadium' = 'grid';
  seatRows: number | null = null;
  seatColumns: number | null = null;
  totalSeats = 0;
  previewRows: string[] = [];
  previewCols: number[] = [];


  constructor(
    private eventService: EventService,
    private seatService: SeatService,
    private locationService: LocationService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.eventId = this.route.snapshot.params['id'];
    this.fetchEvent();

    // Setup location search
    this.locationSearch$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.length < 2) {
          this.locationSuggestions = [];
          return of([]);
        }
        this.isSearchingLocation = true;
        this.cdr.detectChanges();
        return this.locationService.searchCities(query).pipe(
          finalize(() => {
            this.isSearchingLocation = false;
            this.cdr.detectChanges();
          })
        );
      })
    ).subscribe(suggestions => {
      this.locationSuggestions = suggestions;
      this.cdr.detectChanges();
    });
  }

  fetchEvent() {
    this.initialLoading = true;
    this.eventService.getEvent(this.eventId).subscribe({
      next: (event) => {
        this.ticketsSold = event.tickets_sold;
        this.title = event.title;
        this.description = event.description || '';
        this.location = event.location || '';
        this.eventDate = this.formatDate(event.event_date);
        this.gateOpenTime = this.formatDate(event.gate_open_time || '');
        this.eventEndTime = this.formatDate(event.event_end_time || '');
        this.googleMapsUrl = event.google_maps_url || '';
        this.maxTickets = event.max_tickets;
        this.ticketPrice = parseFloat(event.ticket_price || '0');
        this.vipPrice = parseFloat(event.vip_price || '0');
        
        // Infer Free Event Status
        this.isFreeEvent = this.ticketPrice === 0;

        this.refundPolicy = event.refund_policy as any || 'NON_REFUNDABLE';

        this.existingImageUrls = event.image_urls || [];
        this.seatMapEnabled = event.seat_map_enabled;
        this.seatLayout = event.seat_layout || 'grid';
        this.seatRows = event.seat_rows;
        this.seatColumns = event.seat_columns;

        if (this.seatMapEnabled) {
          this.recalcTotal();
        }

        this.initialLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Failed to load event details.';
        this.initialLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }

  // --- Photo Handling ---
  onFilesSelected(event: any) {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    const availableSlots = 5 - (this.selectedFiles.length + this.existingImageUrls.length);
    if (newFiles.length > availableSlots) {
      this.error = 'Maximum 5 images allowed.';
      this.pendingFilesToCrop = newFiles.slice(0, availableSlots);
    } else {
      this.pendingFilesToCrop = newFiles;
    }
    if (this.pendingFilesToCrop.length > 0) this.processNextFileForCropping();
    event.target.value = '';
  }

  processNextFileForCropping() {
    if (this.pendingFilesToCrop.length === 0) {
      this.imageFile = null;
      return;
    }
    const fileToCrop = this.pendingFilesToCrop.shift()!;
    this.currentProcessingFileName = fileToCrop.name;
    this.imageFile = fileToCrop;
  }

  onImageCropped(event: CroppedEvent) {
    const ext = this.currentProcessingFileName.split('.').pop() || 'jpg';
    const baseName = this.currentProcessingFileName.substring(0, this.currentProcessingFileName.lastIndexOf('.'));
    const file = new File([event.blob], `${baseName}_cropped.${ext}`, { type: 'image/jpeg' });
    this.selectedFiles.push(file);
    this.filePreviewUrls.push(event.objectUrl);
    this.imageFile = null;
    this.processNextFileForCropping();
  }

  cancelCrop() {
    this.imageFile = null;
    this.processNextFileForCropping();
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
    URL.revokeObjectURL(this.filePreviewUrls[index]);
    this.filePreviewUrls.splice(index, 1);
  }

  removeExistingFile(index: number) {
    this.existingImageUrls.splice(index, 1);
  }

  getImageUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const baseUrl = environment.apiUrl.replace('/api', '');
    return `${baseUrl}${path}`;
  }

  // --- Location Suggestions ---
  onLocationInput(query: string) { this.locationSearch$.next(query); }
  selectLocation(suggestion: LocationSuggestion) {
    this.location = suggestion.displayName;
    this.locationSuggestions = [];
    this.cdr.detectChanges();
  }
  isValidMapsUrl(url: string): boolean { return url.startsWith('http'); }

  // --- Input Validation ---
  enforceNumeric(event: Event) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/[^0-9]/g, '');
    this.maxTickets = input.value ? parseInt(input.value, 10) : null;
  }

  enforceDecimal(event: Event) {
    const input = event.target as HTMLInputElement;
    let val = input.value.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
    input.value = val;
    if (input.name === 'ticket_price') this.ticketPrice = val ? parseFloat(val) : null;
    else if (input.name === 'vip_price') this.vipPrice = val ? parseFloat(val) : null;
  }

  // --- Seat Map Logic ---
  toggleSeatMap() {
    if (this.ticketsSold > 0) return;
    this.seatMapEnabled = !this.seatMapEnabled;
    this.onSeatMapToggle();
  }

  onSeatMapToggle() {
    if (this.seatMapEnabled) this.recalcTotal();
    else this.totalSeats = 0;
  }

  recalcTotal() {
    const r = this.seatRows ?? 0;
    const c = this.seatColumns ?? 0;
    this.totalSeats = r * c;
    if (this.seatMapEnabled) this.maxTickets = this.totalSeats;
    const pRows = Math.min(r, 5);
    const pCols = Math.min(c, 8);
    this.previewRows = Array.from({ length: pRows }, (_, i) => {
      let n = i;
      let label = '';
      while (n >= 0) {
        label = String.fromCharCode(65 + (n % 26)) + label;
        n = Math.floor(n / 26) - 1;
      }
      return label;
    });
    this.previewCols = Array.from({ length: pCols }, (_, i) => i + 1);
  }

  formatRowRange(rows: number): string {
    const getLabel = (index: number) => {
      let n = index;
      let label = '';
      while (n >= 0) {
        label = String.fromCharCode(65 + (n % 26)) + label;
        n = Math.floor(n / 26) - 1;
      }
      return label;
    };
    const first = getLabel(0);
    const last = rows > 0 ? getLabel(rows - 1) : '';
    return rows > 0 ? `${first}–${last}` : '';
  }

  getMiniStadiumSeatStyle(rowIndex: number, colIndex: number, totalCols: number) {
    const radius = 35 + (rowIndex * 8);
    let angle = 0;
    if (totalCols > 1) {
      const startAngle = -160;
      const step = 320 / (totalCols - 1);
      angle = startAngle + (colIndex * step);
    }
    return { 'transform': `translate(-50%, -50%) rotate(${angle}deg) translateY(${-radius}px)` };
  }

  onSubmit() {
    this.loading = true;
    this.error = '';
    this.success = '';

    const payload: UpdateEventPayload = {
      title: this.title,
      description: this.description,
      location: this.location || undefined,
      event_date: new Date(this.eventDate).toISOString(),
      gate_open_time: new Date(this.gateOpenTime).toISOString(),
      event_end_time: new Date(this.eventEndTime).toISOString(),
      google_maps_url: this.googleMapsUrl || undefined,
      max_tickets: this.maxTickets!,
      ticket_price: this.isFreeEvent ? 0 : this.ticketPrice!,
      vip_price: this.isFreeEvent ? undefined : this.vipPrice || undefined,
      refund_policy: this.refundPolicy,
      status: 'published', // ensure it remains published on update
      image_urls: this.existingImageUrls,
      seat_layout: this.seatMapEnabled ? this.seatLayout : undefined,
    };

    this.eventService.updateEvent(this.eventId, payload).subscribe({
      next: (event) => {
        const finalizeUpdate = () => {
          if (this.seatMapEnabled && this.ticketsSold === 0) {
            // Regeneration logic: if seat configuration exists, we might not want to always regenerate 
            // but the user said "organizer can change/update everything".
            this.seatService.generateSeats(this.eventId).subscribe({
              next: () => {
                this.success = 'Event and seats updated successfully!';
                this.loading = false;
                setTimeout(() => this.router.navigate(['/events', this.eventId]), 1500);
                this.cdr.detectChanges();
              },
              error: () => {
                this.success = 'Event updated, but seat generation failed.';
                this.loading = false;
                setTimeout(() => this.router.navigate(['/events', this.eventId]), 2000);
                this.cdr.detectChanges();
              }
            });
          } else {
            this.success = 'Event updated successfully!';
            this.loading = false;
            setTimeout(() => this.router.navigate(['/events', this.eventId]), 1500);
            this.cdr.detectChanges();
          }
        };

        if (this.selectedFiles.length > 0) {
          this.eventService.uploadImages(this.eventId, this.selectedFiles).subscribe({
            next: () => finalizeUpdate(),
            error: (err) => {
              this.error = 'Event updated, but new images failed to upload: ' + (err.error?.message || err.message);
              setTimeout(() => finalizeUpdate(), 2000);
            }
          });
        } else {
          finalizeUpdate();
        }
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to update event.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  cancel() { this.router.navigate(['/events', this.eventId]); }
}
