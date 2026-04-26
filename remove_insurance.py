import re

file_path = "frontend/src/app/dashboard/find-care/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Interface
text = re.sub(r'\s*insuranceAccepted: string\[\].*?\n', '\n', text)
text = re.sub(r'\s*inNetwork\?: boolean.*?\n', '\n', text)

# 2. Insurance Providers Array
text = re.sub(r'// Insurance providers list.*?\nconst INSURANCE_PROVIDERS = \[[^\]]*\]\n', '', text, flags=re.DOTALL)

# 3. mockLocations & API locations
text = re.sub(r'\s*insuranceAccepted: \[[^\]]*\],?\n', '\n', text)

# 4. State hooks
text = re.sub(r'\s*const \[showInNetworkOnly, setShowInNetworkOnly\] = useState\(false\)\n', '\n', text)
text = re.sub(r"\s*const \[childInsurance, setChildInsurance\] = useState<string>\('[^']+'\)\n", '\n', text)

# 5. enhancedLocations useMemo
text = re.sub(r'\s*const inNetwork = loc\.insuranceAccepted\.includes\(childInsurance\)\n', '\n', text)
text = re.sub(r'\s*inNetwork,\n', '\n', text)
text = re.sub(r'\[childInsurance, healthAcuity, userLocation, latestAssessment\]', '[healthAcuity, userLocation, latestAssessment]', text)

# 6. filteredLocations useMemo
text = re.sub(r'\s*if \(showInNetworkOnly && !loc\.inNetwork\) return false\n', '\n', text)
text = re.sub(r'\s*// Then in-network locations\n\s*if \(a\.inNetwork && !b\.inNetwork\) return -1\n\s*if \(!a\.inNetwork && b\.inNetwork\) return 1\n', '\n', text)
text = re.sub(r'\[enhancedLocations, selectedType, searchQuery, showInNetworkOnly\]', '[enhancedLocations, selectedType, searchQuery]', text)

# 7. Insurance Filter Card UI
card_regex = r'\s*{/\* Insurance Filter \*/}\n\s*<Card className="bg-emerald-50.*?</Card>\n'
text = re.sub(card_regex, '\n', text, flags=re.DOTALL)

# 8. List Header Badge
badge_regex = r'\s*{showInNetworkOnly && \(\n\s*<Badge variant="success" size="sm">\n\s*<CheckCircle className="w-3 h-3 mr-1" />\n\s*Showing In-Network Only\n\s*</Badge>\n\s*\)}'
text = re.sub(badge_regex, '', text)

# 9. Location Card Badges
location_badge_regex = r'\s*{/\* Insurance Badge \*/}\n\s*{location\.inNetwork \? \(\n.*?</Badge>\n\s*\)}'
text = re.sub(location_badge_regex, '', text, flags=re.DOTALL)

# 10. No Locations Found messages
no_loc_regex = r"\{showInNetworkOnly\s*\?\s*'No in-network locations found\. Try disabling the \"In-Network Only\" filter\.'\s*:\s*'Try adjusting your filters or search query'\s*\}"
text = re.sub(no_loc_regex, "'Try adjusting your filters or search query'", text)

no_loc_btn_regex = r'\s*{showInNetworkOnly && \(\n\s*<Button\s*variant="secondary"\s*className="mt-4"\s*onClick=\{[^}]+\}\n\s*>\n\s*Show All Locations\n\s*</Button>\n\s*\)}'
text = re.sub(no_loc_btn_regex, '', text)

# 11. Location Modal Header Badges
modal_badge_regex = r'\s*{selectedLocation\.inNetwork \? \(\n.*?</Badge>\n\s*\)}'
text = re.sub(modal_badge_regex, '', text, flags=re.DOTALL)

# 12. Modal Insurance Accepted
modal_accepts_regex = r'\s*<div className="flex items-center gap-3">\n\s*<Shield className="w-5 h-5 text-surface-600 dark:text-surface-400" />\n\s*<span className="text-surface-700 dark:text-surface-300">\n\s*Accepts: \{selectedLocation\.insuranceAccepted.*?</span>\n\s*</div>'
text = re.sub(modal_accepts_regex, '', text, flags=re.DOTALL)

# 13. Modal Insurance Warning
modal_warning_regex = r'\s*{/\* Insurance Warning \*/}\n\s*{!selectedLocation\.inNetwork && \(\n.*?</p>\n\s*</div>\n\s*</div>\n\s*</div>\n\s*\)}'
text = re.sub(modal_warning_regex, '', text, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(text)

print("Done")
