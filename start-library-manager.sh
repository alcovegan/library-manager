#!/bin/bash

# Set environment variables for better app naming
export ELECTRON_ENABLE_STACK_DUMPING=1
export CFBundleName="Library Manager"
export CFBundleDisplayName="Library Manager"

# Launch Electron with custom app name
exec electron . --name="Library Manager"
