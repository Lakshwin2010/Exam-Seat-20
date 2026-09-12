export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  accessToken: string;
  expiresAt: number;
}

export const GOOGLE_CLIENT_ID = "908678669935-qr97ht5adj4ffc9e74kfl615k7s9qtto.apps.googleusercontent.com";

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              expires_in?: string | number;
            }) => void;
          }) => {
            requestAccessToken: () => void;
          };
        };
      };
    };
  }
}

const STORAGE_KEY = 'examhall_google_user_v1';

export function getStoredUser(): GoogleUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as GoogleUser;
    // If expired, clear
    if (Date.now() > user.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function signInWithGoogle(
  onSuccess: (user: GoogleUser) => void,
  onError: (errorMsg: string) => void
) {
  if (!window.google?.accounts?.oauth2) {
    onError("Google Identity Services script is still loading. Please try again in a moment.");
    return;
  }

  try {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.send",
      callback: async (response) => {
        if (response.error || !response.access_token) {
          onError(response.error || "Failed to obtain authorization token.");
          return;
        }

        try {
          const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${response.access_token}` }
          });
          const profile = await profileRes.json();
          
          const user: GoogleUser = {
            email: profile.email || "user@csacademy.in",
            name: profile.name || profile.given_name || (profile.email ? profile.email.split("@")[0] : "Google User"),
            picture: profile.picture || "",
            accessToken: response.access_token,
            expiresAt: Date.now() + (Number(response.expires_in) || 3600) * 1000
          };

          localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
          onSuccess(user);
        } catch (err: any) {
          onError(err.message || "Failed to retrieve user profile from Google.");
        }
      }
    });

    client.requestAccessToken();
  } catch (err: any) {
    onError(err.message || "Could not launch Google Sign-In prompt.");
  }
}

export function signOutGoogle(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// Convert standard string to UTF-8 Safe Base64URL for Gmail API
function base64UrlEncode(str: string): string {
  // Use UTF-8 bytes to safely encode unicode characters
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface SendClassEmailParams {
  accessToken: string;
  fromEmail: string;
  toEmail: string;
  teacherName?: string;
  className: string;
  sessionName?: string;
  studentCount: number;
  roomSeatsCount?: number;
  xiSeatsCount?: number;
  xiiSeatsCount?: number;
  attachmentFilename: string;
  attachmentBase64: string;
}

export async function sendClassSpreadsheetEmail(params: SendClassEmailParams): Promise<{ id: string; threadId: string }> {
  const boundary = `__ExamHall_Boundary_${Date.now()}__`;
  
  const sessTitle = params.sessionName ? ` - ${params.sessionName}` : '';
  const subject = `ExamHall - Seating & Despatch Plan for Class ${params.className}${sessTitle}`;
  
  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; }
    .card { max-width: 620px; margin: 20px auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; }
    .title { color: #1e3a8a; font-size: 20px; font-weight: bold; margin: 0; }
    .subtitle { color: #64748b; font-size: 13px; margin-top: 4px; }
    .badge { display: inline-block; background-color: #dbeafe; color: #1d4ed8; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold; }
    .badge-green { display: inline-block; background-color: #d1fae5; color: #047857; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; }
    .report-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 12px 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">CS Academy - Examination Cell</div>
      <div class="subtitle">Exam Seating Allocation & Student Despatch Plan</div>
    </div>
    
    <p>Dear <b>${params.teacherName || 'Class Incharge'}</b>,</p>
    
    <p>Please find attached the official examination allocation workbook for <b>Class ${params.className}</b>${params.sessionName ? ` for <b>${params.sessionName}</b>` : ''}.</p>
    
    <p style="font-size: 13px; color: #334155; font-weight: 600;">This workbook contains two separate reports across dedicated spreadsheet tabs:</p>

    <!-- Report 1 Box -->
    <div class="report-box" style="border-left: 4px solid #2563eb;">
      <div style="font-weight: bold; color: #1e3a8a; font-size: 14px; margin-bottom: 4px;">
        1. Tab: Room_${params.className.replace(/ /g, '')}_Seating (Who sits in your classroom)
      </div>
      <div style="font-size: 12px; color: #475569;">
        Desk-by-desk door chart of students writing exams in Room <b>${params.className}</b>:
        <ul style="margin: 6px 0; padding-left: 20px;">
          <li>Total Seated: <b>${params.roomSeatsCount || 0} students</b></li>
          <li>Class XI: <b>${params.xiSeatsCount || 0}</b> | Class XII: <b>${params.xiiSeatsCount || 0}</b> (Alternating checkerboard layout)</li>
        </ul>
      </div>
    </div>

    <!-- Report 2 Box -->
    <div class="report-box" style="border-left: 4px solid #059669;">
      <div style="font-weight: bold; color: #047857; font-size: 14px; margin-bottom: 4px;">
        2. Tab: Class_${params.className.replace(/ /g, '')}_Despatch (Where your students must go)
      </div>
      <div style="font-size: 12px; color: #475569;">
        Complete student roster for home class <b>${params.className}</b> showing:
        <ul style="margin: 6px 0; padding-left: 20px;">
          <li>Total Class Students: <b>${params.studentCount} students</b></li>
          <li>Assigned exam hall, room number, and desk label for every student.</li>
        </ul>
      </div>
    </div>

    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 12px; margin: 16px 0; font-size: 12px;">
      <table style="width: 100%;">
        <tr>
          <td style="color: #64748b;">Dispatched By:</td>
          <td style="font-weight: 600; color: #0f172a;">${params.fromEmail}</td>
        </tr>
        <tr>
          <td style="color: #64748b;">Workbook File:</td>
          <td style="font-weight: 600; color: #2563eb; font-family: monospace;">${params.attachmentFilename}</td>
        </tr>
      </table>
    </div>
    
    <div class="footer">
      Generated automatically via ExamHall - School Exam Seating Allocator & Monitoring System.<br>
      CS Academy Examination Cell
    </div>
  </div>
</body>
</html>
`.trim();

  // Construct standard MIME multipart/mixed message
  const mimeLines: string[] = [
    `From: ${params.fromEmail}`,
    `To: ${params.toEmail}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(bodyHtml))),
    ``,
    `--${boundary}`,
    `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; name="${params.attachmentFilename}"`,
    `Content-Disposition: attachment; filename="${params.attachmentFilename}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    params.attachmentBase64,
    ``,
    `--${boundary}--`
  ];

  const fullMime = mimeLines.join("\r\n");
  const rawBase64Url = base64UrlEncode(fullMime);

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${params.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ raw: rawBase64Url })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData?.error?.message || `Gmail API error HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return await response.json();
}
