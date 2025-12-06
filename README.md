# 📬 Sandbox Mailer

A local email sandbox for Laravel development with a beautiful UI, configurable rate limiting, and latency simulation.

![Sandbox Mailer](https://via.placeholder.com/800x400/0a0a0f/7c5cff?text=Sandbox+Mailer)

## Features

- 📧 **SMTP Server** - Captures all emails sent from your Laravel application
- 🎨 **Beautiful UI** - Modern, dark-themed interface to view and manage emails
- ⏱️ **Rate Limiting** - Configure max emails per second to test throttling
- 🐌 **Latency Simulation** - Add artificial delay to test slow email delivery
- 🔍 **Search & Filter** - Easily find emails by subject, sender, or content
- 📎 **Attachment Support** - View email attachments
- 🌐 **HTML & Text Views** - Toggle between HTML and plain text email views

## Installation

```bash
# Install dependencies
npm install

# Start the server
npm start

# Or for development with auto-reload
npm run dev
```

## Configuration

### Laravel `.env` Setup

Add these settings to your Laravel application's `.env` file:

```env
MAIL_MAILER=smtp
MAIL_HOST=127.0.0.1
MAIL_PORT=2525
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_ENCRYPTION=null
MAIL_FROM_ADDRESS="hello@example.com"
MAIL_FROM_NAME="${APP_NAME}"
```

### Server Ports

| Service | Port | Description |
|---------|------|-------------|
| SMTP    | 2525 | Receives emails from your Laravel app |
| Web UI  | 8025 | Browser interface at http://localhost:8025 |

## Usage

### Rate Limiting

Control how many emails can be sent per second:

1. Click the **⚙️ Settings** button in the header
2. Enable **Rate Limiting**
3. Set **Max emails per second** (e.g., 1)
4. Click **Save Configuration**

When the rate limit is exceeded:
- The SMTP server returns an error
- The error appears in the UI with details
- Your Laravel app will receive the SMTP error

### Latency Simulation

Test how your app handles slow email delivery:

1. Click the **⚙️ Settings** button
2. Enable **Latency Simulation**
3. Set **Min latency** and **Max latency** in milliseconds
4. Click **Save Configuration**

The server will add a random delay between min and max for each email.

### Viewing Emails

- **Email List**: See all received emails with sender, subject, and preview
- **Search**: Filter emails by typing in the search box
- **Email Detail**: Click an email to view its full content
- **HTML/Text Toggle**: Switch between HTML and plain text views
- **Delete**: Remove individual emails or clear all

## API Endpoints

The sandbox exposes a REST API for programmatic access:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/emails` | List all emails |
| GET | `/api/emails/:id` | Get single email |
| DELETE | `/api/emails/:id` | Delete email |
| DELETE | `/api/emails` | Delete all emails |
| GET | `/api/errors` | List rate limit errors |
| DELETE | `/api/errors` | Clear all errors |
| GET | `/api/config` | Get current configuration |
| PUT | `/api/config` | Update configuration |
| GET | `/api/stats` | Get statistics |

### Example: Update Config via API

```bash
curl -X PUT http://localhost:8025/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "rateLimit": {
      "enabled": true,
      "maxPerSecond": 2
    },
    "latency": {
      "enabled": true,
      "minMs": 500,
      "maxMs": 2000
    }
  }'
```

## Testing with Laravel

### Send a Test Email

```php
// routes/web.php
Route::get('/test-email', function () {
    Mail::raw('This is a test email!', function ($message) {
        $message->to('test@example.com')
                ->subject('Test Email from Laravel');
    });
    
    return 'Email sent!';
});
```

### Test Rate Limiting

```php
// Send multiple emails quickly to trigger rate limiting
Route::get('/test-rate-limit', function () {
    for ($i = 1; $i <= 5; $i++) {
        try {
            Mail::raw("Email number $i", function ($message) use ($i) {
                $message->to('test@example.com')
                        ->subject("Rapid Email #$i");
            });
            echo "Email $i sent<br>";
        } catch (\Exception $e) {
            echo "Email $i failed: " . $e->getMessage() . "<br>";
        }
    }
});
```

## Development

The project structure:

```
mailer/
├── server/
│   └── index.js      # SMTP server & API
├── public/
│   ├── index.html    # Web UI
│   ├── styles.css    # Styles
│   └── app.js        # Frontend JavaScript
├── package.json
└── README.md
```

## License

MIT

