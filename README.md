# Ethereum JSON-RPC Analyzer

A comprehensive tool for analyzing Ethereum JSON-RPC responses and testing endpoints to identify potential security vulnerabilities for bug bounty hunting. This tool is specifically designed to be easily deployable on GitHub Pages.

## Features

- **Response Analysis**: Analyze JSON-RPC responses for security vulnerabilities
- **Method Testing**: Test endpoints with various methods and payloads
- **Batch Processing**: Upload and analyze multiple files at once
- **Vulnerability Detection**: Identify issues like stack trace disclosure, private key exposure, and more
- **Visualization**: Visualize findings with charts and detailed reports
- **Export**: Export findings as JSON for reporting

## Deployment to GitHub Pages

### Step 1: Fork the Repository

1. Click the "Fork" button at the top right of this repository
2. Wait for GitHub to create a copy in your account

### Step 2: Enable GitHub Pages

1. Go to your forked repository on GitHub
2. Click on "Settings" in the top navigation bar
3. In the left sidebar, click on "Pages"
4. Under "Build and deployment", select "GitHub Actions" as the source
5. The workflow file included in this repository will handle the deployment process

### Step 3: Trigger the Deployment

The deployment will automatically run when you push to the main branch. You can also manually trigger it:

1. Go to the "Actions" tab in your repository
2. Select the "Build and Deploy" workflow
3. Click "Run workflow" and select the main branch
4. Click the green "Run workflow" button

### Step 4: Configure the Base Path (Important!)

By default, the application is configured to work with a base path of `/eth-jsonrpc-analyzer`. If your repository has a different name, you need to update this:

1. Open the `.github/workflows/deploy.yml` file in your repository
2. Find the line that says `NEXT_PUBLIC_BASE_PATH: /eth-jsonrpc-analyzer`
3. Change it to match your repository name: `NEXT_PUBLIC_BASE_PATH: /your-repo-name`
4. Commit and push the change

### Step 5: Access Your Deployed Application

After the GitHub Actions workflow completes successfully (usually takes 2-3 minutes), your application will be available at:

\`\`\`
https://your-username.github.io/your-repo-name
\`\`\`

Replace `your-username` with your GitHub username and `your-repo-name` with your repository name.

## Local Development

To run the project locally:

\`\`\`bash
# Clone the repository
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
\`\`\`

## Using the Method Tester

The Method Tester allows you to test Ethereum JSON-RPC endpoints with various methods and payloads:

1. Navigate to the Method Tester page
2. Enter the endpoint URL you want to test
3. Configure any custom headers needed
4. Select methods from the predefined categories
5. Generate and optionally modify the request payload
6. Send the request and analyze the response

### Available Method Categories

- **Basic Methods**: Common Ethereum node information and chain methods
- **Account Methods**: Methods related to Ethereum accounts
- **Admin Methods**: Administrative methods that may reveal sensitive information
- **Personal Methods**: Methods related to account management (often restricted)
- **Malformed Requests**: Intentionally malformed requests to test error handling
- **Injection Attempts**: Payloads that attempt to inject or exploit vulnerabilities

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
\`\`\`

Let's also add an accordion component that we'll need:
