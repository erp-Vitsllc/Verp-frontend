$path = "src/app/dashboard/page.jsx"
$lines = Get-Content $path
$newBlock = @(
"                                                 {",
"                                                     label: 'Rejected', count: activeStats.rejected || 0,",
"                                                     activeClass: 'bg-red-600 text-white border-red-600 shadow-red-200',",
"                                                     inactiveClass: 'bg-white text-red-600 border-slate-100 hover:border-red-200 hover:bg-red-50'",
"                                                 },",
"                                                 {",
"                                                     label: 'Overdue', count: activeStats.overdue || 0,",
"                                                     activeClass: 'bg-orange-600 text-white border-orange-600 shadow-orange-200',",
"                                                     inactiveClass: 'bg-white text-orange-600 border-slate-100 hover:border-orange-200 hover:bg-orange-50'",
"                                                 }"
)
$result = $lines[0..1395] + $newBlock + $lines[1410..($lines.Length-1)]
$result | Set-Content $path
