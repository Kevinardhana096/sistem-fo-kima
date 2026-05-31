# Testing Checklist - Supabase Refactor

**Tanggal:** 2026-05-13  
**Status:** Ready for Testing  
**Environment:** Development (Local)

---

## 🎯 Core Features to Test

### **1. Authentication** ✅ CRITICAL

#### Login
- [ ] Login dengan `admin@kima.local` / `<lihat password manager>`
- [ ] Login dengan `teknisi@kima.local` / `<lihat password manager>`
- [ ] Login dengan `isp@kima.local` / `<lihat password manager>`
- [ ] Dev quick access buttons working
- [ ] Error handling untuk wrong credentials
- [ ] Error handling untuk network issues

#### Session Management
- [ ] Session persists after page refresh
- [ ] Logout clears session
- [ ] Redirect to login after logout
- [ ] Protected routes redirect to login when not authenticated

---

### **2. Customers List** ✅ CRITICAL

#### View
- [ ] Customers list loads successfully
- [ ] Customer cards display correctly
- [ ] ISP badges show correctly
- [ ] Status badges (aktif/nonaktif) display
- [ ] Loading state shows while fetching

#### Search & Filter
- [ ] Search by customer name works
- [ ] Filter by ISP works
- [ ] Filter by status works

---

### **3. ISPs List** ✅ CRITICAL

#### View
- [ ] ISPs list loads successfully
- [ ] ISP cards display correctly
- [ ] Contract info shows correctly
- [ ] Status badges display

#### Operations
- [ ] Delete ISP works (admin only)
- [ ] Confirmation dialog shows before delete
- [ ] Success message after delete
- [ ] List refreshes after delete

---

### **4. Create Customer** ✅ CRITICAL

#### Form
- [ ] Form loads correctly
- [ ] All fields editable
- [ ] ISP selection dropdown works
- [ ] Date pickers work
- [ ] Package type selection (core/shared) works
- [ ] Billing period options work

#### Validation
- [ ] Required fields validated
- [ ] Email format validated (if applicable)
- [ ] Number fields validated

#### Submit
- [ ] Create customer succeeds
- [ ] Success message shows
- [ ] Redirects to customer list
- [ ] New customer appears in list

---

### **5. Edit Customer** ✅ CRITICAL

#### Form
- [ ] Form loads with existing data
- [ ] All fields pre-populated correctly
- [ ] Fields editable

#### Submit
- [ ] Update customer succeeds
- [ ] Success message shows
- [ ] Changes reflected in list
- [ ] Detail page shows updated data

---

### **6. Create ISP** ✅ CRITICAL

#### Form
- [ ] Form loads correctly
- [ ] All fields editable
- [ ] Logo upload works (if implemented)
- [ ] Contract file upload works (if implemented)

#### Submit
- [ ] Create ISP succeeds
- [ ] Success message shows
- [ ] Redirects to ISP list
- [ ] New ISP appears in list

---

### **7. Edit ISP** ✅ CRITICAL

#### Form
- [ ] Form loads with existing data
- [ ] All fields pre-populated correctly
- [ ] Fields editable

#### Submit
- [ ] Update ISP succeeds
- [ ] Success message shows
- [ ] Changes reflected in list

---

### **8. Monitoring Billing** ✅ CRITICAL

#### View
- [ ] Monitoring page loads
- [ ] Year selector works
- [ ] Summary stats display correctly
- [ ] Billing table loads with data
- [ ] Month columns (Jan-Dec) display
- [ ] Invoice status colors correct (lunas, belum_bayar, terlambat, belum_ditagih)

#### Filters
- [ ] Filter by ISP works
- [ ] Filter by status works
- [ ] Clear filters works
- [ ] Summary updates after filter

#### Data
- [ ] Customer names display
- [ ] ISP names display
- [ ] Contract numbers display
- [ ] Core allocation display
- [ ] Monthly/yearly amounts display

---

### **9. Role-Based Access** ✅ CRITICAL

#### Admin Role
- [ ] Can view all customers
- [ ] Can create customers
- [ ] Can edit customers
- [ ] Can delete customers
- [ ] Can view all ISPs
- [ ] Can create ISPs
- [ ] Can edit ISPs
- [ ] Can delete ISPs
- [ ] Can view monitoring

#### Teknisi Role
- [ ] Can view all customers (read-only)
- [ ] Cannot create customers
- [ ] Cannot edit customers
- [ ] Cannot delete customers
- [ ] Can view all ISPs (read-only)
- [ ] Cannot create ISPs
- [ ] Cannot edit ISPs
- [ ] Cannot delete ISPs
- [ ] Can view monitoring (read-only)

#### ISP Role
- [ ] Can view all customers (read-only) *
- [ ] Cannot create customers
- [ ] Cannot edit customers
- [ ] Cannot delete customers
- [ ] Can view all ISPs (read-only) *
- [ ] Cannot create ISPs
- [ ] Cannot edit ISPs
- [ ] Cannot delete ISPs
- [ ] Can view monitoring (read-only)

**Note:** * RLS policies simplified - ISP can see all data for now

---

## ⚠️ Known Limitations (Not Tested)

### **Customer Detail Page**
- ⏳ Document upload
- ⏳ Invoice create/update
- ⏳ Contract operations
- ⏳ Route planning
- ⏳ Timeline (disabled)

### **ISP Detail Page**
- ⏳ Not refactored yet
- ⏳ All operations use old API

### **Dashboard Page**
- ⏳ Not checked yet

---

## 🐛 Bug Tracking

### Critical Bugs (Blocker)
*None found yet*

### Major Bugs (Should fix before deploy)
*None found yet*

### Minor Bugs (Can fix later)
*None found yet*

---

## 📊 Test Results

### Test Summary
- **Total Tests:** 0 / 60
- **Passed:** 0
- **Failed:** 0
- **Skipped:** 0

### Test by Category
- **Authentication:** 0 / 8
- **Customers List:** 0 / 5
- **ISPs List:** 0 / 4
- **Create Customer:** 0 / 8
- **Edit Customer:** 0 / 4
- **Create ISP:** 0 / 5
- **Edit ISP:** 0 / 4
- **Monitoring:** 0 / 10
- **Role-Based Access:** 0 / 12

---

## 🚀 Ready for Deployment?

### Checklist
- [ ] All critical tests passed
- [ ] No critical bugs found
- [ ] Authentication working
- [ ] Core CRUD operations working
- [ ] Monitoring page working
- [ ] Role-based access working

### Deployment Decision
- ✅ **YES** - Core features working, detail pages can iterate later
- ❌ **NO** - Critical bugs found, need to fix first

---

## 📝 Testing Notes

### Environment
- **Frontend:** http://localhost:5173
- **Database:** Supabase (production)
- **Auth:** Supabase Auth

### Test Data
- **Admin:** admin@kima.local / <lihat password manager>
- **Teknisi:** teknisi@kima.local / <lihat password manager>
- **ISP:** isp@kima.local / <lihat password manager>

### How to Test
1. Start frontend: `cd frontend && npm run dev`
2. Open browser: http://localhost:5173
3. Login with test credentials
4. Follow checklist above
5. Mark items as tested
6. Report bugs in Bug Tracking section

---

**Last Updated:** 2026-05-13 00:37  
**Tester:** [Your Name]  
**Next Review:** After testing complete
