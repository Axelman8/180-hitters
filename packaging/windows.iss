#ifndef AppVersion
  #define AppVersion "1.8.12"
#endif
[Setup]
AppId={{3CB7F9B3-7440-41A5-84D6-52CC1196C381}
AppName=DartsApp - 180 Hitters
AppVersion={#AppVersion}
AppPublisher=Axelman8
AppPublisherURL=https://github.com/Axelman8/180-hitters
DefaultDirName={localappdata}\Programs\DartsApp
DefaultGroupName=DartsApp
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=..\installer-output
OutputBaseFilename=DartsApp-Setup-Windows-x64
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
UninstallDisplayIcon={app}\DartsApp.exe
[Languages]
Name: "dutch"; MessagesFile: "compiler:Languages\Dutch.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"
[Tasks]
Name: "desktopicon"; Description: "Een bureaubladicoon maken"; Flags: checkedonce
Name: "autostart"; Description: "De achtergrondserver starten wanneer ik mij aanmeld"; Flags: unchecked
[Files]
Source: "..\windows-build\DartsApp\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "INSTALLER-HELP.txt"; DestDir: "{app}"; Flags: ignoreversion
[Icons]
Name: "{group}\DartsApp"; Filename: "{app}\DartsApp.exe"
Name: "{group}\Installatiehulp"; Filename: "{app}\INSTALLER-HELP.txt"
Name: "{group}\DartsApp verwijderen"; Filename: "{uninstallexe}"
Name: "{autodesktop}\DartsApp"; Filename: "{app}\DartsApp.exe"; Tasks: desktopicon
Name: "{userstartup}\DartsApp"; Filename: "{app}\DartsApp.exe"; Parameters: "--background"; Tasks: autostart
[Run]
Filename: "{app}\DartsApp.exe"; Description: "DartsApp starten"; Flags: nowait postinstall skipifsilent
