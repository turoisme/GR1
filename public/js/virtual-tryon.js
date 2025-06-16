class VirtualTryOnManager {
  constructor() {
    this.currentProductId = null;
    this.uploadedImage = null;
    this.isProcessing = false;
    
    this.initializeEventListeners();
    this.setupImageUpload();
  }

  initializeEventListeners() {
    // Image upload
    document.getElementById('imageUpload')?.addEventListener('change', (e) => {
      this.handleImageUpload(e);
    });

    // Try-on button
    document.getElementById('startTryOn')?.addEventListener('click', () => {
      this.startVirtualTryOn();
    });

    // Settings sliders
    ['strength', 'guidance_scale', 'steps'].forEach(param => {
      const slider = document.getElementById(param);
      if (slider) {
        slider.addEventListener('input', (e) => {
          document.getElementById(`${param}Value`).textContent = e.target.value;
        });
      }
    });

    // Batch try-on
    document.getElementById('batchTryOn')?.addEventListener('click', () => {
      this.startBatchTryOn();
    });
  }

  setupImageUpload() {
    const dropZone = document.getElementById('imageDropZone');
    if (!dropZone) return;

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.processImageFile(files[0]);
      }
    });

    // Click to upload
    dropZone.addEventListener('click', () => {
      document.getElementById('imageUpload').click();
    });
  }

  handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
      this.processImageFile(file);
    }
  }

  processImageFile(file) {
    // Validate file
    if (!this.validateImageFile(file)) return;

    // Show preview
    this.showImagePreview(file);
    
    // Store file
    this.uploadedImage = file;
    
    // Enable try-on button
    this.updateTryOnButton();
  }

  validateImageFile(file) {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.showError('Chỉ hỗ trợ file ảnh định dạng JPG, PNG, WEBP');
      return false;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.showError('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 10MB');
      return false;
    }

    return true;
  }

  showImagePreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('imagePreview');
      const placeholder = document.getElementById('uploadPlaceholder');
      
      if (preview && placeholder) {
        preview.src = e.target.result;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
      }
    };
    reader.readAsDataURL(file);
  }

  updateTryOnButton() {
    const button = document.getElementById('startTryOn');
    if (button) {
      button.disabled = !this.uploadedImage || this.isProcessing;
      button.textContent = this.isProcessing ? 
        '🎨 Đang xử lý...' : 
        '✨ Bắt đầu thử đồ';
    }
  }

  async startVirtualTryOn() {
    if (this.isProcessing || !this.uploadedImage) return;

    try {
      this.isProcessing = true;
      this.updateTryOnButton();
      this.showProcessingStatus();

      const formData = new FormData();
      formData.append('image', this.uploadedImage);
      formData.append('productId', this.currentProductId || document.querySelector('[data-product-id]')?.dataset.productId);
      formData.append('strength', document.getElementById('strength')?.value || 0.8);
      formData.append('guidance_scale', document.getElementById('guidance_scale')?.value || 7.5);
      formData.append('steps', document.getElementById('steps')?.value || 20);

      const response = await fetch('/api/virtual-tryon/process', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        this.showTryOnResult(result.data);
      } else {
        this.showError(result.message);
      }

    } catch (error) {
      console.error('Virtual try-on error:', error);
      this.showError('Có lỗi xảy ra khi xử lý ảnh. Vui lòng thử lại.');
    } finally {
      this.isProcessing = false;
      this.updateTryOnButton();
      this.hideProcessingStatus();
    }
  }

  showTryOnResult(data) {
    const resultContainer = document.getElementById('tryOnResult');
    if (!resultContainer) return;

    resultContainer.innerHTML = `
      <div class="try-on-result">
        <div class="result-images">
          <div class="image-comparison">
            <div class="before-after">
              <div class="before">
                <h4>Ảnh gốc</h4>
                <img src="${data.originalImage}" alt="Ảnh gốc">
              </div>
              <div class="after">
                <h4>Kết quả thử đồ</h4>
                <img src="${data.resultImage}" alt="Kết quả thử đồ">
              </div>
            </div>
          </div>
        </div>
        
        <div class="result-actions">
          <button class="btn btn-primary" onclick="VirtualTryOn.downloadResult('${data.resultImage}')">
            💾 Tải về
          </button>
          <button class="btn btn-secondary" onclick="VirtualTryOn.shareResult('${data.id}')">
            📱 Chia sẻ
          </button>
          <button class="btn btn-success" onclick="VirtualTryOn.addToCart('${data.product.id}')">
            🛒 Thêm vào giỏ
          </button>
        </div>
        
        <div class="result-info">
          <p><strong>Sản phẩm:</strong> ${data.product.name}</p>
          <p><strong>Giá:</strong> ${data.product.price.toLocaleString('vi-VN')}đ</p>
          <p><strong>Thời gian:</strong> ${new Date(data.createdAt).toLocaleString('vi-VN')}</p>
        </div>
      </div>
    `;

    resultContainer.style.display = 'block';
    resultContainer.scrollIntoView({ behavior: 'smooth' });
  }

  async startBatchTryOn() {
    const selectedProducts = document.querySelectorAll('.product-checkbox:checked');
    if (selectedProducts.length === 0) {
      this.showError('Vui lòng chọn ít nhất một sản phẩm để thử');
      return;
    }

    if (!this.uploadedImage) {
      this.showError('Vui lòng upload ảnh của bạn');
      return;
    }

    try {
      this.isProcessing = true;
      this.showBatchProcessingStatus(selectedProducts.length);

      const productIds = Array.from(selectedProducts).map(cb => cb.value);
      
      const formData = new FormData();
      formData.append('image', this.uploadedImage);
      formData.append('productIds', JSON.stringify(productIds));

      const response = await fetch('/api/virtual-tryon/batch', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        this.showBatchResults(result.data);
      } else {
        this.showError(result.message);
      }

    } catch (error) {
      console.error('Batch try-on error:', error);
      this.showError('Có lỗi xảy ra khi xử lý batch try-on');
    } finally {
      this.isProcessing = false;
      this.hideBatchProcessingStatus();
    }
  }

  showBatchResults(results) {
    const container = document.getElementById('batchResults');
    if (!container) return;

    const successResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    let html = '<div class="batch-results">';
    
    if (successResults.length > 0) {
      html += '<h3>Kết quả thành công:</h3>';
      html += '<div class="batch-grid">';
      
      successResults.forEach(result => {
        html += `
          <div class="batch-item">
            <img src="${result.data.resultImage}" alt="Kết quả thử đồ">
            <div class="batch-item-info">
              <h4>${result.data.product.name}</h4>
              <p>${result.data.product.price.toLocaleString('vi-VN')}đ</p>
              <div class="batch-actions">
                <button onclick="VirtualTryOn.downloadResult('${result.data.resultImage}')" class="btn-sm">💾</button>
                <button onclick="VirtualTryOn.addToCart('${result.data.product.id}')" class="btn-sm">🛒</button>
              </div>
            </div>
          </div>
        `;
      });
      
      html += '</div>';
    }

    if (failedResults.length > 0) {
      html += '<h3>Lỗi xử lý:</h3>';
      html += '<ul class="error-list">';
      failedResults.forEach(result => {
        html += `<li>Sản phẩm ${result.productId}: ${result.error}</li>`;
      });
      html += '</ul>';
    }

    html += '</div>';
    container.innerHTML = html;
    container.style.display = 'block';
  }

  downloadResult(imageUrl) {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `virtual-tryon-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async shareResult(resultId) {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Kết quả thử đồ ảo - SportShop',
          text: 'Xem kết quả thử đồ ảo của tôi!',
          url: `${window.location.origin}/virtual-tryon/share/${resultId}`
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy link
      const url = `${window.location.origin}/virtual-tryon/share/${resultId}`;
      navigator.clipboard.writeText(url).then(() => {
        this.showSuccess('Link đã được copy vào clipboard!');
      });
    }
  }

  async addToCart(productId) {
    try {
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId: productId,
          quantity: 1,
          color: 'Mặc định',
          size: 'M'
        })
      });

      const result = await response.json();

      if (result.success) {
        this.showSuccess('Đã thêm vào giỏ hàng!');
        // Update cart counter
        this.updateCartCounter();
      } else {
        this.showError(result.message);
      }
    } catch (error) {
      this.showError('Có lỗi khi thêm vào giỏ hàng');
    }
  }

  showProcessingStatus() {
    const status = document.getElementById('processingStatus');
    if (status) {
      status.innerHTML = `
        <div class="processing-animation">
          <div class="spinner"></div>
          <p>🎨 Đang xử lý ảnh với AI...</p>
          <p class="sub-text">Quá trình này có thể mất 30-60 giây</p>
        </div>
      `;
      status.style.display = 'block';
    }
  }

  hideProcessingStatus() {
    const status = document.getElementById('processingStatus');
    if (status) {
      status.style.display = 'none';
    }
  }

  showBatchProcessingStatus(count) {
    const status = document.getElementById('processingStatus');
    if (status) {
      status.innerHTML = `
        <div class="processing-animation">
          <div class="spinner"></div>
          <p>🎨 Đang xử lý ${count} sản phẩm...</p>
          <p class="sub-text">Ước tính: ${count * 45} giây</p>
          <div class="progress-bar">
            <div class="progress-fill" id="batchProgress"></div>
          </div>
        </div>
      `;
      status.style.display = 'block';
    }
  }

  hideBatchProcessingStatus() {
    this.hideProcessingStatus();
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <span>${message}</span>
      <button onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  updateCartCounter() {
    // Update cart counter in header
    fetch('/api/cart/count')
      .then(response => response.json())
      .then(data => {
        const counter = document.querySelector('.cart-count');
        if (counter && data.success) {
          counter.textContent = data.count;
        }
      });
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.VirtualTryOn = new VirtualTryOnManager();
});