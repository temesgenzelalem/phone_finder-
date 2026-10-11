# Phone Finder — Project Specification

## 1. Project Overview

Phone Finder is an Android-first phone recovery system designed to help
a user locate and secure their lost phone using another phone or a web
browser.

The system consists of:
- A Flutter Android application installed on the phone being protected.
- A secure backend API and database.
- A web-based Emergency Mode for accessing recovery features.
- Firebase Cloud Messaging (FCM) for delivering remote commands.

The system must prioritize security, user consent, privacy, reliability,
and clear communication about what actions have actually succeeded.

## 2. Main Objectives

1. Allow users to register and protect their Android phone.
2. Let users identify a protected phone using a unique Phone Tag.
3. Authenticate emergency access with a six-digit PIN.
4. Show the most recent available location of a lost phone.
5. Request an updated location when the phone is online and able to respond.
6. Remotely request the phone to ring or lock when supported.
7. Notify the owner about recovery activity and security events.
8. Provide a simple and responsive Emergency Mode web interface.

## 3. User Registration and Device Enrollment

- The user installs and opens the Android application.
- The user creates an account or completes the chosen secure enrollment flow.
- The application generates or registers a unique Phone Tag.
- The user configures a six-digit emergency PIN.
- The user explicitly grants the required permissions.
- The application registers the device with the backend and FCM.
- The backend associates the Phone Tag with the enrolled device.
- Enrollment must require the device owner's consent.
- The application must clearly explain location tracking and device-locking
  permissions before requesting them.
- The system must support revoking a device's enrollment.

Do not assume that a Phone Tag alone proves ownership.

## 4. Emergency Mode

Emergency Mode is accessible from a web browser or a supported application flow.

The user enters:
- Phone Tag
- Six-digit emergency PIN

After successful authentication, the interface can offer:
- View the last known location.
- Request an updated location.
- Request the phone to ring.
- Request the phone to lock.
- View the status of recovery commands.
- End the emergency session.

Only show actions that are authorized and supported by the enrolled device.

## 5. Location Tracking

- Use Android location services through Flutter plugins or native Android
  integration where necessary.
- Store latitude, longitude, accuracy, and the location timestamp.
- Display when the location was recorded.
- Clearly distinguish a last-known location from a newly received location.
- If the phone is offline, display the latest stored location rather than
  pretending it is live.
- Normal tracking may target an update approximately every five minutes.
- Emergency tracking may target updates approximately every 15 seconds
  while active and permitted.
- These intervals are targets, not guarantees. Android background limits,
  battery optimization, permissions, connectivity, and device settings may
  prevent updates at the requested frequency.
- Use a visible notification or foreground service when required by Android.
- Explain location collection to the user and provide an appropriate way
  to stop tracking or revoke consent.

## 6. Remote Ring

- An authenticated user can request that the enrolled phone ring.
- Deliver the request through FCM or another appropriate backend mechanism.
- Use a unique command ID and an expiry time.
- Record command status as Pending, Delivered, Executed, Failed, or Expired.
- Do not report success merely because the backend accepted the request.
- Ringing depends on Android permissions, device state, volume policies,
  application execution, and platform restrictions.
- Explain when the command cannot be confirmed.

## 7. Remote Lock

- Allow an authorized user to request a supported Android screen lock.
- Investigate Android DevicePolicyManager and the required device-admin
  authorization.
- Explain the permission to the device owner before enabling it.
- Do not promise that remote locking will work on every Android device.
- Record command status and report only the result that can be verified.
- Do not implement remote wipe in the initial version.

## 8. Authentication and Security

- Store emergency PINs using a suitable password-hashing algorithm such
  as Argon2id. Never store the PIN in plaintext.
- Because the PIN has only six digits, enforce server-side rate limits.
- A proposed initial policy is five failed attempts followed by a
  15-minute pause. Review the policy to prevent attackers from bypassing
  limits by changing IP addresses or creating sessions.
- Apply appropriate limits by device, Phone Tag, IP address, and session.
- Avoid revealing whether a Phone Tag exists through error messages.
- Use HTTPS for all production communication.
- Use secure, short-lived emergency sessions.
- Set emergency sessions to expire after 15 minutes unless a reviewed
  security design specifies otherwise.
- Allow the user to end or revoke a session.
- Do not store authentication tokens in browser localStorage.
- Use appropriate secure cookie settings if cookies are used.
- Apply Cache-Control: no-store to sensitive responses where appropriate.
- Validate all input on the server.
- Protect APIs against unauthorized access, replay, enumeration, and abuse.
- Keep secrets out of source control and client-side code.

## 9. Command Delivery and Device Status

The backend must not confuse command creation with command execution.

Each command should contain:
- Unique command ID
- Enrolled device ID
- Command type
- Creation timestamp
- Expiry timestamp
- Current status
- Delivery and execution timestamps when available
- Safe error details when applicable

Commands should be idempotent where possible. Expired or revoked commands
must not execute. The device should acknowledge receipt and report execution
results when it is able to communicate with the backend.

## 10. Notifications and Audit Logs

Notify the owner about relevant events, including:
- Successful emergency authentication
- Repeated failed authentication attempts
- A location request
- Ring or lock command results
- Device enrollment or revocation
- Important account or security changes

Maintain audit records with timestamps, event types, and relevant identifiers.
Do not put PINs, access tokens, or unnecessary sensitive location data in logs.
Define a reasonable retention and deletion policy.

## 11. Offline and Low-Battery Behavior

- The backend cannot communicate with a completely disconnected phone
  through FCM until connectivity returns.
- Display the last known location and its timestamp when the phone is offline.
- Queue or expire commands according to a clearly defined policy.
- A low-battery location attempt may be considered if technically feasible
  and permitted, but must not be promised.
- Do not promise that the phone can upload its location immediately before
  shutdown or that tracking continues after the phone is powered off.

## 12. Suggested Technology Options

Mobile:
- Flutter
- Geolocator or an appropriate location solution
- Firebase Cloud Messaging
- Google Maps or Flutter Map
- Native Kotlin integration where Flutter plugins cannot meet Android needs

Backend:
- Laravel REST API
- PostgreSQL database
- FCM integration

Web:
- Next.js with Tailwind CSS, or a lightweight alternative
- Responsive layout for mobile and desktop browsers

These are proposed choices, not final decisions. Compare alternatives before
commit-ting to the architecture.

## 13. Initial Database Concepts

Evaluate the need for tables or equivalent models for:
- Users
- Devices
- Device enrollment and authorization
- PIN credential metadata
- Location records
- Emergency sessions
- Device commands
- Notifications
- Audit events
- Device heartbeats and status

Define relationships, indexes, retention, and access policies before coding.

## 14. Privacy and User Control

- Obtain explicit consent for tracking and device permissions.
- Make tracking state understandable to the owner.
- Do not hide the application or bypass Android security controls.
- Do not collect unrelated personal information.
- Restrict location access to authorized users.
- Provide device revocation and session termination.
- Clear sensitive information from the web interface when a session ends,
  while recognizing that complete removal of all browser traces cannot
  be guaranteed.
- Document what information is collected, why, and how long it is retained.

## 15. Initial Scope and Exclusions

Version 1 focuses on Android phone recovery and Emergency Mode on the web.

Do not include these features in the first implementation unless the
technical review establishes a strong reason:
- iOS support
- Remote wipe
- SIM-change detection
- Guaranteed SMS-based offline commands
- Continuous location history
- Geofencing
- Features requiring privileged or manufacturer-specific Android access

## 16. Quality and Evaluation

Define measurable tests for:
- Authentication and rate-limit behavior
- Unauthorized-access prevention
- Location freshness and accuracy
- Command delivery and execution reporting
- Behavior when offline
- Session expiry and revocation
- Battery and resource use
- Accessibility and responsive design

Record limitations and failures honestly. Never describe a simulated result
as a real device capability.

## 17. Research and Scholarship Potential

Investigate whether the project can support a research question such as:

"How can a privacy-preserving Android phone recovery system improve the
reliability and security of emergency recovery actions under intermittent
connectivity and Android background-execution constraints?"

Propose measurable metrics, a reproducible evaluation method, realistic
test scenarios, and a comparison baseline. Do not claim novelty until
related work has been reviewed.

## 18. Required Technical Review

Before implementation, produce:

1. A review of feasibility, risks, contradictions, and missing requirements.
2. A corrected and complete specification.
3. A proposed architecture and component responsibilities.
4. API endpoints, authentication rules, and example request/response shapes.
5. A database design and security model.
6. A milestone-based development and testing roadmap.
7. A research evaluation plan with measurable metrics.
8. A list of assumptions and decisions that require the owner's approval.

Do not implement application code until the review is complete and the
important architectural decisions have been explained.
