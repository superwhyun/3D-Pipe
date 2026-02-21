# Use a base image with Python
FROM python:3.10-slim

# Install system dependencies for Blender
RUN apt-get update && apt-get install -y \
    libx11-6 \
    libxi6 \
    libxrender1 \
    libgl1 \
    libfontconfig1 \
    libxkbcommon0 \
    libxkbcommon-x11-0 \
    libsm6 \
    libxfixes3 \
    libxcursor1 \
    libxinerama1 \
    libusb-1.0-0 \
    libdbus-1-3 \
    libxrandr2 \
    libgl1-mesa-dri \
    wget \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Download and install Blender
# Using Blender 3.6 LTS as a stable version
RUN wget https://download.blender.org/release/Blender3.6/blender-3.6.5-linux-x64.tar.xz \
    && tar -xvf blender-3.6.5-linux-x64.tar.xz \
    && mv blender-3.6.5-linux-x64 /usr/local/blender \
    && ln -s /usr/local/blender/blender /usr/bin/blender \
    && rm blender-3.6.5-linux-x64.tar.xz

# Install Python dependencies
RUN pip install runpod fastapi uvicorn python-multipart

# Set working directory
WORKDIR /app

# Copy application files
COPY converter.py .
COPY handler.py .

# Run the handler
CMD ["python", "-u", "handler.py"]
