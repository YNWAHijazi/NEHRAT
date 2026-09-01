/**
 * Where each role lands, and who the organizer surface belongs to.
 *
 * There were two answers to this and they disagreed. The demonstration sign-in routed
 * by role; the credentialed sign-in redirected everyone to /dashboard. So a Ministry
 * administrator signing in with an email and password arrived on the ORGANIZER's
 * surface -- Events, Venues, Facilities, a Start a service menu, and their own name
 * over an organizer's dashboard. Both paths read one derivation now.
 */

import { describe, expect, it } from 'vitest';
import { landingRouteFor, usesOrganizerSurface } from '../lib/rules';

const EVERY_ROLE = [
  'organizer', 'ems', 'director', 'response',
  'reviewer', 'ministry_admin', 'order', 'platform_owner',
] as const;

describe('the landing route', () => {
  it('never sends a Ministry role to the organizer surface', () => {
    for (const role of ['reviewer', 'ministry_admin', 'order', 'platform_owner']) {
      expect(landingRouteFor(role), `${role} must not land on /dashboard`).not.toBe('/dashboard');
      expect(usesOrganizerSurface(role), `${role} must be refused the organizer surface`).toBe(false);
    }
  });

  it('sends the console roles to the console', () => {
    for (const role of ['reviewer', 'ministry_admin']) {
      expect(landingRouteFor(role)).toBe('/ministry');
    }
  });

  it('keeps the organizer surface for the three roles it is built for', () => {
    for (const role of ['organizer', 'ems', 'director']) {
      expect(usesOrganizerSurface(role)).toBe(true);
      expect(landingRouteFor(role)).toBe('/dashboard');
    }
  });

  it('sends the first-response unit to its own surface, not to a refusal', () => {
    expect(usesOrganizerSurface('response')).toBe(false);
    expect(landingRouteFor('response')).toBe('/first-response/readiness');
  });

  it('gives every role a route, and an unknown role the sign-in screen', () => {
    for (const role of EVERY_ROLE) {
      expect(landingRouteFor(role), `${role} has no route`).toMatch(/^\//);
    }
    // Never a plausible guess for something unrecognised -- landing somewhere
    // plausible is exactly how this broke.
    expect(landingRouteFor('something_new')).toBe('/signin');
    expect(landingRouteFor('')).toBe('/signin');
  });
});
