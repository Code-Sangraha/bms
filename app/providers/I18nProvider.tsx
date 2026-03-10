"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Locale = "en" | "ne";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (text: string) => string;
};

const STORAGE_KEY = "app-locale";

const translations: Record<string, string> = {
  "Sign in": "साइन इन",
  "Enter your credentials to access Highland Meat Processing.": "Highland Meat Processing पहुँच गर्न आफ्नो विवरण प्रविष्ट गर्नुहोस्।",
  "No token received. Please try again.": "टोकन प्राप्त भएन। कृपया फेरि प्रयास गर्नुहोस्।",
  "Something went wrong. Please try again.": "केही गलत भयो। कृपया फेरि प्रयास गर्नुहोस्।",
  Email: "इमेल",
  Password: "पासवर्ड",
  "Signing in…": "साइन इन हुँदैछ…",
  "Don't have an account?": "खाता छैन?",
  Register: "दर्ता गर्नुहोस्",
  "Create account": "खाता बनाउनुहोस्",
  "Register to get started with BMS.": "BMS सुरु गर्न दर्ता गर्नुहोस्।",
  "User name": "प्रयोगकर्ता नाम",
  "Full name": "पूरा नाम",
  "Confirm password": "पासवर्ड पुष्टि गर्नुहोस्",
  "Creating account…": "खाता बनाउँदैछ…",
  "Already have an account?": "पहिले नै खाता छ?",
  Dashboard: "ड्यासबोर्ड",
  "Sales, billing and attendance at a glance.": "बिक्री, बिलिङ र हाजिरी एकै नजरमा।",
  "Sales & Billing": "बिक्री र बिलिङ",
  "View full analytics": "पूरा विश्लेषण हेर्नुहोस्",
  "Loading sales…": "बिक्री लोड हुँदैछ…",
  "Failed to load sales": "बिक्री लोड गर्न सकिएन",
  "Total Revenue": "कुल आम्दानी",
  Transactions: "कारोबारहरू",
  "Weight Sold": "बिक्री भएको तौल",
  "Quantity Sold": "बिक्री भएको परिमाण",
  "Top outlets": "शीर्ष आउटलेटहरू",
  "Top products": "शीर्ष उत्पादनहरू",
  "Top customers": "शीर्ष ग्राहकहरू",
  "No sales data yet.": "अहिलेसम्म बिक्री डाटा छैन।",
  Attendance: "हाजिरी",
  "Total Staff": "कुल कर्मचारी",
  "4 departments": "४ विभाग",
  "Present Today": "आज उपस्थित",
  "70% present": "७०% उपस्थित",
  "Daily attendance": "दैनिक हाजिरी",
  Name: "नाम",
  "Clock In": "प्रवेश",
  "Clock Out": "निर्गमन",
  Status: "स्थिति",
  Present: "उपस्थित",
  Absent: "अनुपस्थित",
  Settings: "सेटिङ्स",
  "Outlet Management": "आउटलेट व्यवस्थापन",
  "Manage processing plants, retail stores, and distribution centers":
    "प्रशोधन केन्द्र, खुद्रा पसल र वितरण केन्द्रहरू व्यवस्थापन गर्नुहोस्",
  "Add Outlet": "आउटलेट थप्नुहोस्",
  "Loading outlets…": "आउटलेटहरू लोड हुँदैछन्…",
  "Failed to load outlets": "आउटलेटहरू लोड गर्न सकिएन",
  "No outlets yet. Add one to get started.": "अहिलेसम्म कुनै आउटलेट छैन। सुरु गर्न एउटा थप्नुहोस्।",
  Active: "सक्रिय",
  Inactive: "निष्क्रिय",
  "More options": "थप विकल्पहरू",
  Delete: "मेटाउनुहोस्",
  Manager: "प्रबन्धक",
  Contact: "सम्पर्क",
  "View details": "विवरण हेर्नुहोस्",
  Edit: "सम्पादन गर्नुहोस्",
  "Delete outlet": "आउटलेट मेटाउनुहोस्",
  Cancel: "रद्द गर्नुहोस्",
  "Quickly add a new outlet to your organization":
    "आफ्नो संस्थामा छिटो नयाँ आउटलेट थप्नुहोस्",
  Discard: "रद्द गर्नुहोस्",
  "Saving…": "सेभ हुँदैछ…",
  Save: "सेभ गर्नुहोस्",
  "Outlet name": "आउटलेट नाम",
  "Select manager": "प्रबन्धक छान्नुहोस्",
  "User Management": "प्रयोगकर्ता व्यवस्थापन",
  "Manage system users and permissions": "सिस्टम प्रयोगकर्ता र अनुमतिहरू व्यवस्थापन गर्नुहोस्",
  "Add User": "प्रयोगकर्ता थप्नुहोस्",
  "Search users": "प्रयोगकर्ताहरू खोज्नुहोस्",
  "Employee ID": "कर्मचारी आईडी",
  Role: "भूमिका",
  "Loading users…": "प्रयोगकर्ताहरू लोड हुँदैछन्…",
  "Failed to load users": "प्रयोगकर्ताहरू लोड गर्न सकिएन",
  "No users yet. Add one to get started.": "अहिलेसम्म कुनै प्रयोगकर्ता छैन। सुरु गर्न एउटा थप्नुहोस्।",
  "Quickly add a new user to your team": "आफ्नो टोलीमा छिटो नयाँ प्रयोगकर्ता थप्नुहोस्",
  "Select role": "भूमिका छान्नुहोस्",
  Overview: "अवलोकन",
  Outlets: "आउटलेटहरू",
  Users: "प्रयोगकर्ताहरू",
  Departments: "विभागहरू",
  Roles: "भूमिकाहरू",
  Analytics: "विश्लेषण",
  "Point of Sale": "बिक्री काउन्टर",
  "Customer Types": "ग्राहक प्रकारहरू",
  Product: "उत्पादन",
  Products: "उत्पादनहरू",
  "Product Type": "उत्पादन प्रकार",
  Pricelist: "मूल्यसूची",
  Live: "ताजा",
  Processed: "प्रशोधित",
  "Clock In/Out": "हाजिरी लगाउने/निस्कने",
  Directory: "डाइरेक्टरी",
  Logout: "लगआउट",
  "Close menu": "मेनु बन्द गर्नुहोस्",
  Dismiss: "हटाउनुहोस्",
  Close: "बन्द गर्नुहोस्",
  "Close modal": "मोडल बन्द गर्नुहोस्",
  Confirm: "पुष्टि गर्नुहोस्",
  Pagination: "पृष्ठीकरण",
  Showing: "देखाइएको",
  of: "मध्ये",
  "per page": "प्रति पृष्ठ",
  "Items per page": "प्रति पृष्ठ वस्तुहरू",
  "Previous page": "अघिल्लो पृष्ठ",
  Previous: "अघिल्लो",
  "Page numbers": "पृष्ठ नम्बरहरू",
  Page: "पृष्ठ",
  "Next page": "अर्को पृष्ठ",
  Next: "अर्को",
  "Switch to Nepali": "नेपालीमा बदल्नुहोस्",
  "Switch to English": "अंग्रेजीमा बदल्नुहोस्",
  "Track revenue, transactions and sales performance.":
    "आम्दानी, कारोबार र बिक्री प्रदर्शन ट्र्याक गर्नुहोस्।",
  "12 months": "१२ महिना",
  "3 months": "३ महिना",
  "30 days": "३० दिन",
  "7 days": "७ दिन",
  "24 hours": "२४ घण्टा",
  "Filter by outlet": "आउटलेट अनुसार फिल्टर गर्नुहोस्",
  "All Outlets": "सबै आउटलेटहरू",
  "Last sync: 2mins": "पछिल्लो सिङ्क: २ मिनेट",
  "Loading analytics…": "विश्लेषण लोड हुँदैछ…",
  "Failed to load analytics": "विश्लेषण लोड गर्न सकिएन",
  "Total Transactions": "कुल कारोबार",
  "Total Weight": "कुल तौल",
  "Total Quantity": "कुल परिमाण",
  "Outlet Performance": "आउटलेट प्रदर्शन",
  "Sales by Product": "उत्पादन अनुसार बिक्री",
  "Amount (Rs.)": "रकम (रु.)",
  "Weight (kg)": "तौल (केजी)",
  Quantity: "परिमाण",
  "Sales by Customer": "ग्राहक अनुसार बिक्री",
  Customer: "ग्राहक",
  "Select product and outlet.": "उत्पादन र आउटलेट छान्नुहोस्।",
  "Select type (Retail/Wholesale) for this product.":
    "यस उत्पादनका लागि प्रकार (खुद्रा/थोक) छान्नुहोस्।",
  "Add at least one product and select an outlet.":
    "कम्तीमा एउटा उत्पादन थप्नुहोस् र एउटा आउटलेट छान्नुहोस्।",
  "Enter customer details.": "ग्राहक विवरण प्रविष्ट गर्नुहोस्।",
  Transaction: "कारोबार",
  "Scan barcode or search products": "बारकोड स्क्यान गर्नुहोस् वा उत्पादन खोज्नुहोस्",
  "Current Sale": "हालको बिक्री",
  "Customer Details": "ग्राहक विवरण",
  "Customer name": "ग्राहक नाम",
  "Phone or email": "फोन वा इमेल",
  "Customer contact": "ग्राहक सम्पर्क",
  Outlet: "आउटलेट",
  "Select outlet": "आउटलेट छान्नुहोस्",
  "Product Name": "उत्पादन नाम",
  "Select product": "उत्पादन छान्नुहोस्",
  Type: "प्रकार",
  "Price type for this line (Retail/Wholesale)":
    "यस लाइनको मूल्य प्रकार (खुद्रा/थोक)",
  "Retail / Wholesale": "खुद्रा / थोक",
  "+ Add Product": "+ उत्पादन थप्नुहोस्",
  "PRODUCT NAME": "उत्पादन नाम",
  TYPE: "प्रकार",
  QUANTITY: "परिमाण",
  "SUB-TOTAL": "उप-कुल",
  Remove: "हटाउनुहोस्",
  "No products added. Select product, type (Retail/Wholesale), and quantity above.":
    "कुनै उत्पादन थपिएको छैन। माथिबाट उत्पादन, प्रकार (खुद्रा/थोक) र परिमाण छान्नुहोस्।",
  "Remove line": "लाइन हटाउनुहोस्",
  Total: "कुल",
  "Processing…": "प्रक्रिया हुँदैछ…",
  Checkout: "चेकआउट",
  "Confirm checkout": "चेकआउट पुष्टि गर्नुहोस्",
  "Are you sure you want to checkout? This will complete the sale and add it to transactions.":
    "तपाईं चेकआउट गर्न निश्चित हुनुहुन्छ? यसले बिक्री पूरा गरी कारोबारमा थप्नेछ।",
  "1 Item": "१ वस्तु",
  Items: "वस्तुहरू",
  "Recent Transactions": "हालका कारोबारहरू",
  "View and manage recent sales transactions":
    "हालका बिक्री कारोबारहरू हेर्नुहोस् र व्यवस्थापन गर्नुहोस्",
  Search: "खोज्नुहोस्",
  "Search transactions": "कारोबारहरू खोज्नुहोस्",
  "Transaction ID": "कारोबार आईडी",
  "Date & Time": "मिति र समय",
  Amount: "रकम",
  Actions: "कार्यहरू",
  "Loading transactions…": "कारोबारहरू लोड हुँदैछन्…",
  "Failed to load transactions": "कारोबारहरू लोड गर्न सकिएन",
  "No transactions yet.": "अहिलेसम्म कुनै कारोबार छैन।",
  "No transactions match your search.":
    "तपाईंको खोजसँग मिल्ने कुनै कारोबार भेटिएन।",
  "View details for transaction": "कारोबारको विवरण हेर्नुहोस्",
  "Qty (kg)": "परिमाण (केजी)",
  Price: "मूल्य",
  "Manage customer types for retail and wholesale":
    "खुद्रा र थोकका लागि ग्राहक प्रकारहरू व्यवस्थापन गर्नुहोस्",
  "Add Customer Type": "ग्राहक प्रकार थप्नुहोस्",
  "Search customer types": "ग्राहक प्रकारहरू खोज्नुहोस्",
  "Loading…": "लोड हुँदैछ…",
  "Failed to load": "लोड गर्न सकिएन",
  "No customer types yet. Add one to get started.":
    "अहिलेसम्म कुनै ग्राहक प्रकार छैन। सुरु गर्न एउटा थप्नुहोस्।",
  "No items match": "कुनै वस्तु मिलेन",
  "Delete customer type": "ग्राहक प्रकार मेटाउनुहोस्",
  "Are you sure you want to delete": "तपाईं मेटाउन निश्चित हुनुहुन्छ",
  "This action cannot be undone.": "यो कार्य फिर्ता लिन सकिँदैन।",
  "Edit Customer Type": "ग्राहक प्रकार सम्पादन गर्नुहोस्",
  "e.g. Wholesale": "जस्तै: थोक",
  "Create a new customer type for sales":
    "बिक्रीका लागि नयाँ ग्राहक प्रकार सिर्जना गर्नुहोस्",
  items: "वस्तुहरू",
  "Sales and revenue overview from dashboard.":
    "ड्यासबोर्डबाट बिक्री र आम्दानीको अवलोकन।",
  "Loading dashboard sales…": "ड्यासबोर्ड बिक्री लोड हुँदैछ…",
  "Failed to load dashboard sales": "ड्यासबोर्ड बिक्री लोड गर्न सकिएन",
  "Total Sales": "कुल बिक्री",
  "Dashboard data": "ड्यासबोर्ड डाटा",
  "No dashboard sales data available.":
    "ड्यासबोर्ड बिक्री डाटा उपलब्ध छैन।",
  "e.g. Main processing plant": "जस्तै: मुख्य प्रशोधन केन्द्र",
  "e.g. 987654321": "जस्तै: ९८७६५४३२१",
  "Manage Outlet": "आउटलेट व्यवस्थापन",
  "Manager ID": "प्रबन्धक आईडी",
  "Failed to update outlet": "आउटलेट अद्यावधिक गर्न सकिएन",
  "No users match": "कुनै प्रयोगकर्ता मिलेन",
  "e.g. John Smith": "जस्तै: राम शर्मा",
  "e.g. john@example.com": "जस्तै: ram@example.com",
  "e.g. +91 9876543210": "जस्तै: +९७७ ९८७६५४३२१०",
  Department: "विभाग",
  "Organize your team by departments for clarity":
    "स्पष्टताको लागि आफ्नो टोलीलाई विभाग अनुसार व्यवस्थित गर्नुहोस्",
  "Add Department": "विभाग थप्नुहोस्",
  "Search departments": "विभागहरू खोज्नुहोस्",
  "Loading departments…": "विभागहरू लोड हुँदैछन्…",
  "Failed to load departments": "विभागहरू लोड गर्न सकिएन",
  "No departments yet. Add one to get started.":
    "अहिलेसम्म कुनै विभाग छैन। सुरु गर्न एउटा थप्नुहोस्।",
  "No departments match": "कुनै विभाग मिलेन",
  "Delete department": "विभाग मेटाउनुहोस्",
  "Edit Department": "विभाग सम्पादन गर्नुहोस्",
  "Department name": "विभाग नाम",
  "e.g. Production": "जस्तै: उत्पादन",
  "Quickly add a new department": "छिटो नयाँ विभाग थप्नुहोस्",
  "Dual Pricing System": "दुई-स्तरीय मूल्य प्रणाली",
  "Manage retail and wholesale pricing":
    "खुद्रा र थोक मूल्य व्यवस्थापन गर्नुहोस्",
  "Upgrade Price": "मूल्य अद्यावधिक गर्नुहोस्",
  "Search dual pricing": "दुई-स्तरीय मूल्य खोज्नुहोस्",
  "No dual pricing yet. Add one to get started.":
    "अहिलेसम्म कुनै दुई-स्तरीय मूल्य छैन। सुरु गर्न एउटा थप्नुहोस्।",
  "Retail Price": "खुद्रा मूल्य",
  "Wholesale Price": "थोक मूल्य",
  Margin: "मार्जिन",
  Cost: "लागत",
  "Delete dual pricing": "दुई-स्तरीय मूल्य मेटाउनुहोस्",
  "Are you sure you want to delete this dual pricing entry? This action cannot be undone.":
    "तपाईं यो दुई-स्तरीय मूल्य प्रविष्टि मेटाउन निश्चित हुनुहुन्छ? यो कार्य फिर्ता लिन सकिँदैन।",
  "Edit dual pricing": "दुई-स्तरीय मूल्य सम्पादन गर्नुहोस्",
  "Wholesale price": "थोक मूल्य",
  "Retail price": "खुद्रा मूल्य",
  "Add dual pricing": "दुई-स्तरीय मूल्य थप्नुहोस्",
  "Set wholesale and retail prices for a product at an outlet":
    "एउटा आउटलेटमा उत्पादनको थोक र खुद्रा मूल्य सेट गर्नुहोस्",
  "Staff Management": "कर्मचारी व्यवस्थापन",
  "Employee Directory": "कर्मचारी निर्देशिका",
  "Manage employee information and roles":
    "कर्मचारी जानकारी र भूमिकाहरू व्यवस्थापन गर्नुहोस्",
  "Add Employees": "कर्मचारी थप्नुहोस्",
  "Search employees": "कर्मचारीहरू खोज्नुहोस्",
  IOT: "आईओटी",
  "Loading employees…": "कर्मचारीहरू लोड हुँदैछन्…",
  "Failed to load employees": "कर्मचारीहरू लोड गर्न सकिएन",
  "No employees yet. Add one to get started.":
    "अहिलेसम्म कुनै कर्मचारी छैन। सुरु गर्न एउटा थप्नुहोस्।",
  "No employees match": "कुनै कर्मचारी मिलेन",
  "Register employee": "कर्मचारी दर्ता गर्नुहोस्",
  "Add a new employee to the directory":
    "निर्देशिकामा नयाँ कर्मचारी थप्नुहोस्",
  "e.g. TXN-001": "जस्तै: TXN-001",
  "e.g. 1ab2c58a": "जस्तै: 1ab2c58a",
  "e.g. Employ number one": "जस्तै: कर्मचारी नम्बर एक",
  "Select department": "विभाग छान्नुहोस्",
  "e.g. 9876543210": "जस्तै: ९८७६५४३२१०",
  Accounts: "खाताहरू",
  "Manage roles and permissions for your team":
    "आफ्नो टोलीका लागि भूमिका र अनुमतिहरू व्यवस्थापन गर्नुहोस्",
  "Create role": "भूमिका सिर्जना गर्नुहोस्",
  "Search roles": "भूमिकाहरू खोज्नुहोस्",
  "Loading roles…": "भूमिकाहरू लोड हुँदैछन्…",
  "Failed to load roles": "भूमिकाहरू लोड गर्न सकिएन",
  "No roles yet. Create one to get started.":
    "अहिलेसम्म कुनै भूमिका छैन। सुरु गर्न एउटा सिर्जना गर्नुहोस्।",
  "No roles match": "कुनै भूमिका मिलेन",
  "Delete role": "भूमिका मेटाउनुहोस्",
  "Edit Role": "भूमिका सम्पादन गर्नुहोस्",
  "Role name": "भूमिका नाम",
  "e.g. Employee": "जस्तै: कर्मचारी",
  "Add a new role to assign to users (e.g. Employee, Manager).":
    "प्रयोगकर्ताहरूलाई दिन नयाँ भूमिका थप्नुहोस् (जस्तै: कर्मचारी, प्रबन्धक)।",
  "Creating…": "सिर्जना हुँदैछ…",
  "Please select an employee.": "कृपया एक कर्मचारी छान्नुहोस्।",
  "Clock-IN/OUT": "हाजिरी प्रवेश/निर्गमन",
  "Track staff attendance and working hours":
    "कर्मचारी हाजिरी र काम गर्ने घण्टा ट्र्याक गर्नुहोस्",
  "Clock in": "हाजिरी लगाउनुहोस्",
  HOURS: "घण्टा",
  MINUTES: "मिनेट",
  SECONDS: "सेकेन्ड",
  "You are clocked in. Click Clock-OUT when you finish.":
    "तपाईंले हाजिरी लगाइसक्नुभएको छ। सकिएपछि Clock-OUT क्लिक गर्नुहोस्।",
  "Start tracking your time by clocking in.":
    "हाजिरी लगाएर आफ्नो समय ट्र्याक सुरु गर्नुहोस्।",
  "Select employee": "कर्मचारी छान्नुहोस्",
  "Clock-OUT": "हाजिरी समाप्त",
  "Clock-IN": "हाजिरी सुरु",
  "Weekly Work": "साप्ताहिक काम",
  "14h 30m": "१४ घण्टा ३० मिनेट",
  "This week": "यो हप्ता",
  "Absent Today": "आज अनुपस्थित",
  "Track staff attendance and working hours.":
    "कर्मचारी हाजिरी र काम गर्ने घण्टा ट्र्याक गर्नुहोस्।",
  "Daily Attendance": "दैनिक हाजिरी",
  "Total Hours": "कुल घण्टा",
  "Create and manage products by type and outlet":
    "प्रकार र आउटलेट अनुसार उत्पादन सिर्जना र व्यवस्थापन गर्नुहोस्",
  "Add Product": "उत्पादन थप्नुहोस्",
  "Loading products…": "उत्पादनहरू लोड हुँदैछन्…",
  "Failed to load products": "उत्पादनहरू लोड गर्न सकिएन",
  "No products yet. Add one to get started.":
    "अहिलेसम्म कुनै उत्पादन छैन। सुरु गर्न एउटा थप्नुहोस्।",
  "Delete product": "उत्पादन मेटाउनुहोस्",
  "Create a new product with type, outlet, and quantity":
    "प्रकार, आउटलेट र परिमाणसहित नयाँ उत्पादन सिर्जना गर्नुहोस्",
  "Product name": "उत्पादन नाम",
  "e.g. Pork": "जस्तै: पोर्क",
  "Select product type": "उत्पादन प्रकार छान्नुहोस्",
  "e.g. 45.2": "जस्तै: 45.2",
  "Created by (optional, user UUID)":
    "सिर्जना गर्ने (वैकल्पिक, प्रयोगकर्ता UUID)",
  "e.g. 601756be-54be-4623-8e97-7ff891e43081":
    "जस्तै: 601756be-54be-4623-8e97-7ff891e43081",
  "Install App": "एप इन्स्टल गर्नुहोस्",
  "Install BMS on your device for quick access.":
    "छिटो पहुँचको लागि आफ्नो उपकरणमा BMS इन्स्टल गर्नुहोस्।",
  "Edit Product": "उत्पादन सम्पादन गर्नुहोस्",
  "Manage product types such as processed, raw, and packaged":
    "प्रशोधित, कच्चा र प्याकेज्ड जस्ता उत्पादन प्रकारहरू व्यवस्थापन गर्नुहोस्",
  "Add Product Type": "उत्पादन प्रकार थप्नुहोस्",
  "Loading product types…": "उत्पादन प्रकारहरू लोड हुँदैछन्…",
  "Failed to load product types": "उत्पादन प्रकारहरू लोड गर्न सकिएन",
  "No product types yet. Add one to get started.":
    "अहिलेसम्म कुनै उत्पादन प्रकार छैन। सुरु गर्न एउटा थप्नुहोस्।",
  "Delete product type": "उत्पादन प्रकार मेटाउनुहोस्",
  "Add a new product type (e.g. processed, raw, packaged)":
    "नयाँ उत्पादन प्रकार थप्नुहोस् (जस्तै: प्रशोधित, कच्चा, प्याकेज्ड)।",
  "e.g. processed": "जस्तै: प्रशोधित",
  "Edit Product Type": "उत्पादन प्रकार सम्पादन गर्नुहोस्",
  "Restock failed": "पुनः भण्डारण असफल भयो",
  "Deduct failed": "कटौती असफल भयो",
  "Live Products": "ताजा उत्पादनहरू",
  "Products of type Live": "ताजा प्रकारका उत्पादनहरू",
  "Search live products": "ताजा उत्पादनहरू खोज्नुहोस्",
  'No product type named "Live" found.':
    '"Live" नामको कुनै उत्पादन प्रकार फेला परेन।',
  "No live products match": "कुनै ताजा उत्पादन मिलेन",
  "No live products yet.": "अहिलेसम्म कुनै ताजा उत्पादन छैन।",
  Restock: "पुनः भण्डारण",
  Deduct: "कटौती",
  "Enter quantity": "परिमाण प्रविष्ट गर्नुहोस्",
  "Processed Products": "प्रशोधित उत्पादनहरू",
  "Products of type Processed": "प्रशोधित प्रकारका उत्पादनहरू",
  "Search processed products": "प्रशोधित उत्पादनहरू खोज्नुहोस्",
  'No product type named "Processed" found.':
    '"Processed" नामको कुनै उत्पादन प्रकार फेला परेन।',
  "No processed products match": "कुनै प्रशोधित उत्पादन मिलेन",
  "No processed products yet.": "अहिलेसम्म कुनै प्रशोधित उत्पादन छैन।",
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "ne") {
      setLocaleState(stored);
    }
  }, []);

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
  };

  const toggleLocale = () => {
    setLocale(locale === "en" ? "ne" : "en");
  };

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t: (text: string) => (locale === "ne" ? translations[text] ?? text : text),
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
