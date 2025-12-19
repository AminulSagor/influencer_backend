# Complete Endpoint Mapping with DTOs

## Auth Endpoints (Influencer)

### 1. POST /influencer/auth/signup
- DTO: SignupDto
- Body:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "brandName": "My Brand",
  "phone": "+8801XXXXXXXXX",
  "email": "user@example.com",
  "password": "Password123",
  "role": "influencer"
}
```

### 2. POST /influencer/auth/verify-otp
- DTO: VerifyOtpDto
- Body:
```json
{
  "phone": "+8801XXXXXXXXX",
  "otp": "123456"
}
```

### 3. POST /influencer/auth/resend-otp
- DTO: ResendOtpDto
- Body:
```json
{
  "phone": "+8801XXXXXXXXX"
}
```

### 4. POST /influencer/auth/login
- DTO: LoginDto
- Body:
```json
{
  "phone": "+8801XXXXXXXXX",
  "password": "Password123"
}
```

### 5. POST /influencer/auth/forgot-password
- DTO: ForgotPasswordDto
- Body:
```json
{
  "identifier": "+8801XXXXXXXXX"
}
```

### 6. POST /influencer/auth/reset-password
- DTO: ResetPasswordDto
- Body:
```json
{
  "identifier": "+8801XXXXXXXXX",
  "otp": "123456",
  "newPassword": "NewPassword123"
}
```

### 7. POST /influencer/auth/create-admin
- DTO: CreateAdminDto
- Body:
```json
{
  "email": "admin@example.com",
  "firstName": "Admin",
  "lastName": "User",
  "password": "AdminPass123",
  "phone": "+8801XXXXXXXXX"
}
```

---

## Admin Endpoints (32 total)

### Influencer Verification (8)

#### 1. GET /influencer/admin/verification/influencers?page=1&limit=20
- Params: page, limit
- Response: Paginated list of influencers

#### 2. GET /influencer/admin/verification/influencers/:id
- Params: id (UUID)
- Response: Single influencer details

#### 3. PATCH /influencer/admin/verification/niches/:influencerId/:niche
- Params: influencerId, niche (string)
- Body:
```json
{
  "identifier": "niche_name",
  "status": "approved",
  "rejectReason": ""
}
```

#### 4. PATCH /influencer/admin/verification/skills/:influencerId/:skill
- Params: influencerId, skill (string)
- Body:
```json
{
  "identifier": "skill_name",
  "status": "approved",
  "rejectReason": ""
}
```

#### 5. PATCH /influencer/admin/verification/socials/:influencerId/:social
- Params: influencerId, social (string)
- Body:
```json
{
  "identifier": "social_url",
  "status": "approved",
  "rejectReason": ""
}
```

#### 6. PATCH /influencer/admin/verification/payouts/:influencerId/:accountNo
- Params: influencerId, accountNo
- Body:
```json
{
  "accountNo": "123456789",
  "status": "approved",
  "rejectReason": ""
}
```

#### 7. PATCH /influencer/admin/verification/nid/:influencerId
- Params: influencerId
- Body:
```json
{
  "nidStatus": "approved",
  "rejectReason": ""
}
```

#### 8. PATCH /influencer/admin/verification/basic-info/:influencerId
- Params: influencerId
- Body:
```json
{
  "status": "approved",
  "rejectReason": ""
}
```

### Admin Settings (14)

#### 9-22. Admin Settings endpoints
(Platform configuration, system settings, etc.)

### Client Verification (7)

#### 23. GET /influencer/admin/verification/clients?page=1&limit=20
- Params: page, limit
- Response: Paginated list of clients

#### 24. GET /influencer/admin/verification/clients/nid/pending
- Params: page, limit
- Response: Pending NID verification

#### 25. GET /influencer/admin/verification/clients/trade-license/pending
- Params: page, limit
- Response: Pending trade license verification

#### 26. GET /influencer/admin/verification/clients/:id
- Params: id (UUID)
- Response: Client details

#### 27. PATCH /influencer/admin/verification/clients/nid/:id
- Params: id
- Body:
```json
{
  "status": "approved",
  "rejectReason": ""
}
```

#### 28. PATCH /influencer/admin/verification/clients/trade-license/:id
- Params: id
- Body:
```json
{
  "status": "approved",
  "rejectReason": ""
}
```

#### 29. PATCH /influencer/admin/verification/clients/social/:id
- Params: id
- Body:
```json
{
  "status": "approved",
  "rejectReason": ""
}
```

### Campaign Management (3)

#### 30. GET /influencer/admin/campaigns
#### 31. GET /influencer/admin/campaigns/:id
#### 32. GET /influencer/admin/campaigns/stats

---

## Client Endpoints (10 total)

### 1. POST /client/auth/signup
- DTO: CreateClientDto
- Body:
```json
{
  "brandName": "My Brand",
  "firstName": "John",
  "lastName": "Doe",
  "email": "client@example.com",
  "phone": "+8801XXXXXXXXX",
  "password": "Password123"
}
```

### 2. GET /client/profile
- Response: Client profile

### 3. PATCH /client/profile/address
- Body:
```json
{
  "thana": "Thana name",
  "zilla": "Zilla name",
  "fullAddress": "Complete address"
}
```

### 4. PATCH /client/profile/social
- Body:
```json
{
  "platform": "facebook",
  "url": "https://facebook.com/..."
}
```

### 5. PATCH /client/profile/nid
- Body:
```json
{
  "nidNumber": "1234567890123",
  "nidFrontImg": "url_or_file_path",
  "nidBackImg": "url_or_file_path"
}
```

### 6. PATCH /client/profile/trade-license
- Body:
```json
{
  "tradeLicenseNumber": "123456",
  "tradeLicenseImg": "url_or_file_path"
}
```

### 7. PATCH /client/profile/onboarding
- Body:
```json
{
  "step": 1,
  "data": {}
}
```

### 8. PATCH /client/profile/general
- Body:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "newemail@example.com"
}
```

### 9. GET /client/admin/get-all
- Params: page, limit
- Response: All clients

### 10. GET /client/admin/:id
- Params: id
- Response: Single client

---

## Influencer Profile Endpoints (10 total)

### 1. GET /influencer/profile
- Response: User profile

### 2. PATCH /influencer/profile/basic-info
- Body:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "bio": "Bio text",
  "dateOfBirth": "1990-01-01"
}
```

### 3. POST /influencer/profile/niches
- Body:
```json
{
  "nicheName": "Fashion"
}
```

### 4. DELETE /influencer/profile/niche/:nicheName
- Params: nicheName

### 5. POST /influencer/profile/skills
- Body:
```json
{
  "skillName": "Photography"
}
```

### 6. DELETE /influencer/profile/skills/:skillName
- Params: skillName

### 7. POST /influencer/profile/payouts
- Body:
```json
{
  "accountType": "bank",
  "accountNo": "123456789",
  "bankName": "Bank Name",
  "accountHolderName": "Name"
}
```

### 8. DELETE /influencer/profile/payouts
- Response: Delete payout method

### 9. PATCH /influencer/profile/address
- Body:
```json
{
  "thana": "Thana",
  "zilla": "Zilla",
  "fullAddress": "Full address"
}
```

### 10. DELETE /influencer/profile/profile-image
- Response: Delete profile image

---

## Campaign Endpoints (38 total)

### Client - Campaign Creation (10)

#### 1. POST /campaign
- DTO: CreateCampaignStep1Dto
- Body:
```json
{
  "campaignName": "Summer Campaign",
  "campaignType": "product_launch"
}
```

#### 2. PATCH /campaign/:id/step-2
- DTO: UpdateCampaignStep2Dto
- Params: id
- Body:
```json
{
  "productType": "Fashion",
  "campaignNiche": "Fashion & Beauty",
  "preferredInfluencerIds": ["uuid1", "uuid2"],
  "notPreferableInfluencerIds": ["uuid3"]
}
```

#### 3. PATCH /campaign/:id/step-3
- DTO: UpdateCampaignStep3Dto
- Body:
```json
{
  "campaignGoals": "Increase brand awareness",
  "productServiceDetails": "Product details",
  "reportingRequirements": "Weekly reports",
  "usageRights": "6 months",
  "startingDate": "2025-01-01",
  "duration": 30
}
```

#### 4. PATCH /campaign/:id/step-4
- DTO: UpdateCampaignStep4Dto
- Body:
```json
{
  "baseBudget": 50000,
  "milestones": [
    {
      "contentTitle": "Post 1",
      "platform": "instagram",
      "contentQuantity": "1",
      "deliveryDays": 7,
      "expectedReach": 10000,
      "expectedViews": 15000,
      "baseBudget": 25000
    }
  ]
}
```

#### 5. PATCH /campaign/:id/step-5
- DTO: UpdateCampaignStep5Dto
- Body:
```json
{
  "assets": [
    {
      "assetType": "image",
      "assetUrl": "https://...",
      "description": "Campaign asset"
    }
  ]
}
```

#### 6. POST /campaign/:id/place
- Params: id
- Body: Empty {}

#### 7. GET /campaign/my-campaigns?page=1&limit=20&status=draft
- Params: page, limit, status

#### 8. GET /campaign/:id
- Params: id

#### 9. DELETE /campaign/:id
- Params: id

#### 10. DELETE /campaign/asset/:assetId
- Params: assetId

### Client - Negotiation (5)

#### 11. POST /campaign/negotiation/counter-offer
- DTO: CounterOfferDto
- Body:
```json
{
  "campaignId": "uuid",
  "proposedBaseBudget": 60000
}
```

#### 12. POST /campaign/negotiation/accept
- DTO: AcceptNegotiationDto
- Body:
```json
{
  "campaignId": "uuid"
}
```

#### 13. POST /campaign/negotiation/reject
- DTO: RejectCampaignDto
- Body:
```json
{
  "campaignId": "uuid",
  "reason": "Budget too low"
}
```

#### 14. GET /campaign/:id/negotiations?page=1&limit=20
- Params: id, page, limit

#### 15. GET /campaign/budget/preview?baseBudget=50000
- Params: baseBudget

### Admin - Management (6)

#### 16. GET /campaign/admin/all?page=1&limit=20&status=active
- Params: page, limit, status

#### 17. GET /campaign/admin/:id
- Params: id

#### 18. PATCH /campaign/admin/:id/status
- DTO: UpdateCampaignStatusDto
- Params: id
- Body:
```json
{
  "status": "active",
  "reason": "Approved"
}
```

#### 19. POST /campaign/admin/negotiation/send-quote
- DTO: SendQuoteDto
- Body:
```json
{
  "campaignId": "uuid",
  "proposedBaseBudget": 50000
}
```

#### 20. POST /campaign/admin/negotiation/accept
- DTO: AcceptNegotiationDto
- Body:
```json
{
  "campaignId": "uuid"
}
```

#### 21. POST /campaign/admin/negotiation/reject
- DTO: RejectCampaignDto
- Body:
```json
{
  "campaignId": "uuid",
  "reason": "Rejected reason"
}
```

### Admin - Negotiations (6)

#### 22. GET /campaign/admin/:id/negotiations?page=1&limit=20
- Params: id, page, limit

#### 23. POST /campaign/admin/:id/reset-negotiation
- Params: id

#### 24-27. Additional negotiation endpoints

### Admin - Assignments (8)

#### 28. POST /campaign/admin/assign
- DTO: AssignCampaignDto
- Body:
```json
{
  "campaignId": "uuid",
  "influencerId": "uuid"
}
```

#### 29. GET /campaign/admin/:id/assignments
- Params: id

#### 30. GET /campaign/admin/assignments/all?page=1&limit=10&status=pending
- Params: page, limit, status

#### 31. PATCH /campaign/admin/assignments/:assignmentId
- DTO: UpdateAssignmentDto
- Params: assignmentId
- Body:
```json
{
  "offeredAmount": 25000,
  "message": "Great opportunity!"
}
```

#### 32-35. Additional assignment endpoints

### Influencer - Jobs (7)

#### 36. GET /campaign/influencer/jobs?page=1&limit=10&status=new
- Params: page, limit, status

#### 37. GET /campaign/influencer/jobs/:id
- Params: id

#### 38. POST /campaign/influencer/jobs/:assignmentId/accept
- DTO: AcceptJobDto
- Params: assignmentId
- Body:
```json
{
  "message": "Excited to work!"
}
```

---

## LeadManager Auth (1)

### 1. POST /auth/login
- DTO: LoginDto
- Body:
```json
{
  "email": "leadmanager@example.com",
  "password": "Password123"
}
```

---

## B2B Endpoints (8)

### 1. POST /b2b
- DTO: CreateB2bDto
- Body: Comprehensive B2B lead details

### 2. POST /b2b/bulk
- Bulk create B2B leads

### 3. GET /b2b?page=1&limit=20
- Params: page, limit

### 4. GET /b2b/search?keyword=test
- Params: keyword

### 5. GET /b2b/export
- Export B2B leads

### 6. GET /b2b/:id
- Params: id

### 7. PATCH /b2b/:id
- DTO: UpdateB2bDto
- Params: id
- Body: Updated B2B details

### 8. DELETE /b2b/:id
- Params: id

---

## B2C Endpoints (8)

### 1-8. Similar to B2B (CRUD operations)

---

## Upload (2)

### 1. POST /upload/signed-url
- DTO: GetUploadUrlDto
- Body:
```json
{
  "fileName": "avatar.jpg",
  "fileType": "image/jpeg",
  "module": "influencer-profile"
}
```

### 2. GET /upload/signed-url/:key
- Params: key

---

## Notifications (3)

### 1. GET /notifications?page=1&limit=20

### 2. PATCH /notifications/:id/read
- Params: id

### 3. PATCH /notifications/read-all

---

## App (1)

### 1. GET /
- Response: App greeting message

